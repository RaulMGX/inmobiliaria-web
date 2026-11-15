import { Global, Module } from '@nestjs/common';
import { GroqService } from './groq.service';
import { MetaApiService } from './meta-api.service';
import { SupabaseStorageService } from './supabase-storage.service';

@Global()
@Module({
  providers: [MetaApiService, GroqService, SupabaseStorageService],
  exports: [MetaApiService, GroqService, SupabaseStorageService],
})
export class IntegracionesModule {}
