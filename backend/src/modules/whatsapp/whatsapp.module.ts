import { Module } from '@nestjs/common';
import { WhatsappCronController } from './whatsapp-cron.controller';
import { WhatsappWebhookController } from './whatsapp-webhook.controller';
import { WhatsappController } from './whatsapp.controller';
import { WhatsappService } from './whatsapp.service';

@Module({
  controllers: [WhatsappController, WhatsappWebhookController, WhatsappCronController],
  providers: [WhatsappService],
  exports: [WhatsappService],
})
export class WhatsappModule {}
