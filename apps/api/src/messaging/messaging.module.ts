import { Module } from '@nestjs/common';
import { ThreadsController } from './threads.controller.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { AuthModule } from '../auth/auth.module.js';
import { ThreadCreateService } from './services/thread-create.service.js';
import { ThreadListService } from './services/thread-list.service.js';
import { MessageCreateService } from './services/message-create.service.js';
import { MessageListService } from './services/message-list.service.js';
import { MessageReadService } from './services/message-read.service.js';
import { ContactInfoService } from './services/contact-info.service.js';
import { ThreadParticipantGuard } from './guards/thread-participant.guard.js';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [ThreadsController],
  providers: [ThreadCreateService, ThreadListService, MessageCreateService, MessageListService, MessageReadService, ContactInfoService, ThreadParticipantGuard],
})
export class MessagingModule {}