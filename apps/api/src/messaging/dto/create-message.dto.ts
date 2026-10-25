import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Max length for a single V1 text message. */
export const MESSAGE_MAX_LENGTH = 4000;

/**
 * DTO for sending a message inside a thread. All message metadata is
 * server-controlled: senderId comes from the JWT, threadId from the URL, and
 * type/wasRedacted/originalBody are set or omitted by the service. The client
 * only supplies the body.
 */
export class CreateMessageDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(MESSAGE_MAX_LENGTH)
  body: string;
}