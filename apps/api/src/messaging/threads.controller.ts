import { Body, Controller, Get, Logger, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CreateThreadDto } from './dto/create-thread.dto.js';
import { CreateMessageDto } from './dto/create-message.dto.js';
import { ListMessagesDto } from './dto/list-messages.dto.js';
import { CurrentUser } from '../auth/decorators/current-user.decorator.js';
import type { TokenPayload } from '../auth/jwt/jwt-token.service.js';
import { ThreadCreateService } from './services/thread-create.service.js';
import { ThreadListService } from './services/thread-list.service.js';
import { MessageCreateService } from './services/message-create.service.js';
import { MessageListService, type MessagePage } from './services/message-list.service.js';
import { MessageReadService, type MessageReadResult } from './services/message-read.service.js';
import { ThreadParticipantGuard } from './guards/thread-participant.guard.js';
import { CurrentThread } from './decorators/current-thread.decorator.js';
import type { ThreadModel } from '../generated/prisma/models/Thread.js';

@Controller('threads')
export class ThreadsController {
  private readonly logger = new Logger(ThreadsController.name);

  constructor(
    private readonly createService: ThreadCreateService,
    private readonly listService: ThreadListService,
    private readonly messageService: MessageCreateService,
    private readonly messageListService: MessageListService,
    private readonly messageReadService: MessageReadService,
  ) {}

  /** Opens (or returns the existing) conversation between the buyer and the
   * seller for one listing. Idempotent: repeated calls return Thread A. */
  @Post()
  @UseGuards(AuthGuard('jwt'))
  async createThread(@Body() dto: CreateThreadDto, @CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] POST /threads - userId=${user.sub}, listingId=${dto.listingId}`);
    const thread = await this.createService.createThread(dto.listingId, user.sub);
    this.logger.log(`[RESPONSE] POST /threads - threadId=${thread.id}`);
    return { success: true, message: 'Conversation thread ready', thread };
  }

  /** Lists every conversation for the current user (active listings only),
   * newest to oldest. Declared before :id so 'my' isn't captured as an id. */
  @Get('my')
  @UseGuards(AuthGuard('jwt'))
  async getMyThreads(@CurrentUser() user: TokenPayload) {
    this.logger.log(`[REQUEST] GET /threads/my - userId=${user.sub}`);
    const threads = await this.listService.getMyThreads(user.sub);
    this.logger.log(`[RESPONSE] GET /threads/my - count=${threads.length}`);
    return { success: true, threads };
  }

  /** Accesses a single thread. Only the buyer or the seller may read it. */
  @Get(':id')
  @UseGuards(AuthGuard('jwt'), ThreadParticipantGuard)
  async getThread(@Param('id') id: string, @CurrentThread() thread: ThreadModel) {
    this.logger.log(`[RESPONSE] GET /threads/${id} - threadId=${thread.id}`);
    return { success: true, thread };
  }

  /** Reads one page of the conversation, newest message first.
   * @Get(':id') can't swallow this route — Express matches :id against a
   * single segment only. The guard has already loaded the thread, so only a
   * message query runs here. */
  @Get(':id/messages')
  @UseGuards(AuthGuard('jwt'), ThreadParticipantGuard)
  async getMessages(
    @Param('id') id: string,
    @Query() dto: ListMessagesDto,
    @CurrentThread() thread: ThreadModel,
  ): Promise<{ success: true; data: MessagePage }> {
    this.logger.log(
      `[REQUEST] GET /threads/${id}/messages - limit=${dto.limit}, cursor=${dto.cursor ? 'present' : 'none'}`,
    );
    const page = await this.messageListService.getMessages(thread, {
      limit: dto.limit,
      cursor: dto.cursor,
    });
    this.logger.log(
      `[RESPONSE] GET /threads/${id}/messages - count=${page.messages.length}, hasNextPage=${page.pagination.hasNextPage}`,
    );
    return { success: true, data: page };
  }

  /** Marks the other participant's unread messages in this thread as read.
   * Separate from GET — reading history and mutating read state are different
   * operations. Idempotent: reopening a thread just reports updatedCount 0. */
  @Patch(':id/messages/read')
  @UseGuards(AuthGuard('jwt'), ThreadParticipantGuard)
  async markMessagesRead(
    @Param('id') id: string,
    @CurrentUser() user: TokenPayload,
    @CurrentThread() thread: ThreadModel,
  ): Promise<{ success: true; data: MessageReadResult }> {
    this.logger.log(`[REQUEST] PATCH /threads/${id}/messages/read - userId=${user.sub}`);
    const result = await this.messageReadService.markAsRead(thread, user.sub);
    this.logger.log(
      `[RESPONSE] PATCH /threads/${id}/messages/read - updatedCount=${result.updatedCount}`,
    );
    return { success: true, data: result };
  }

  /** Sends a text message in the conversation. Guarded so req.thread is
   * already loaded and the caller is a verified ACTIVE participant. */
  @Post(':id/messages')
  @UseGuards(AuthGuard('jwt'), ThreadParticipantGuard)
  async sendMessage(
    @Param('id') id: string,
    @Body() dto: CreateMessageDto,
    @CurrentUser() user: TokenPayload,
    @CurrentThread() thread: ThreadModel,
  ) {
    this.logger.log(`[REQUEST] POST /threads/${id}/messages - userId=${user.sub}`);
    const message = await this.messageService.createMessage(thread, user.sub, dto.body);
    this.logger.log(`[RESPONSE] POST /threads/${id}/messages - messageId=${message.id}`);
    return { success: true, message: 'Message sent successfully', data: message };
  }
}
