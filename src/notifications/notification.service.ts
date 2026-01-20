import { Injectable, Logger } from "@nestjs/common";

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  async sendEmail(to: string, message: string) {
    this.logger.log(`send email to ${to} with message ${message}`);
  }
}
