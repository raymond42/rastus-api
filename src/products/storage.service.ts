import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { WebSocket as NodeWebSocket } from 'ws';
import { PrismaService } from '../prisma/prisma.service';
import {
  ALLOWED_IMAGE_TYPES,
  CreateUploadUrlDto,
  MAX_IMAGE_BYTES,
} from './dto/create-upload-url.dto';

@Injectable()
export class StorageService {
  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async createUploadUrl(productId: string, dto: CreateUploadUrlDto) {
    if (
      !ALLOWED_IMAGE_TYPES.includes(dto.contentType) ||
      dto.sizeBytes < 1 ||
      dto.sizeBytes > MAX_IMAGE_BYTES
    ) {
      throw new BadRequestException(
        'Image must be jpeg, png, or webp and at most 5 MB',
      );
    }

    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    });
    if (!product) {
      throw new NotFoundException(`Product ${productId} not found`);
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const serviceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );
    const bucket = this.configService.get<string>('SUPABASE_STORAGE_BUCKET');
    if (!supabaseUrl || !serviceRoleKey || !bucket) {
      throw new InternalServerErrorException(
        'Supabase storage is not configured',
      );
    }

    const path = `products/${productId}/${randomUUID()}-${sanitizeFileName(dto.fileName)}`;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
      // Node 20 has no global WebSocket; Supabase realtime requires one
      // even when we only use Storage.
      realtime: {
        transport: NodeWebSocket as unknown as typeof WebSocket,
      },
    });
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(path);

    if (error || !data) {
      throw new InternalServerErrorException(
        error?.message || 'Failed to create a signed upload URL',
      );
    }

    return {
      path: data.path,
      token: data.token,
      signedUrl: data.signedUrl,
    };
  }
}

function sanitizeFileName(fileName: string): string {
  const base = fileName.split(/[/\\]/).pop() ?? 'image';
  const cleaned = base.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return cleaned.slice(0, 80) || 'image';
}
