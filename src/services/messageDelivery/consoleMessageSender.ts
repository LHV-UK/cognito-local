import boxen from "boxen";
import { Context } from "../context";
import { Message } from "../messages";
import { User } from "../userPoolService";
import { MessageSender } from "./messageSender";
import * as fs from "fs"

export class ConsoleMessageSender implements MessageSender {
  public sendEmail(
    ctx: Context,
    user: User,
    destination: string,
    message: Message
  ): Promise<void> {
    return this.sendToConsole(ctx, user, destination, message);
  }

  public sendSms(
    ctx: Context,
    user: User,
    destination: string,
    message: Message
  ): Promise<void> {
    return this.sendToConsole(ctx, user, destination, message);
  }

  private sendToConsole(
    ctx: Context,
    user: User,
    destination: string,
    { __code, ...message }: Message
  ): Promise<void> {
    const fields = {
      Username: user.Username,
      Destination: destination,
      Code: __code,
      "Email Subject": message.emailSubject,
      "Email Message": message.emailMessage,
      "SMS Message": message.smsMessage,
    };
    const definedFields = Object.entries(fields).filter(
      (kv): kv is [string, string] => !!kv[1]
    );

    const longestDefinedFieldName = Math.max(
      ...definedFields.map(([k]) => k.length)
    );
    const formattedFields = definedFields.map(
      ([k, v]) => `${(k + ":").padEnd(longestDefinedFieldName + 1)} ${v}`
    );

    ctx.logger.info(
      boxen(`Confirmation Code Delivery\n\n${formattedFields.join("\n")}`, {
        borderStyle: "round" as any,
        borderColor: "yellow",
        padding: 1,
      })
    );

    // So that any codes generated can be picked up by automated processes,
    // if a message location is given, then write to that location the code.
    const messageLocation = process.env.MESSAGE_LOCATION
    if (messageLocation) {
      fs.writeFileSync(messageLocation, JSON.stringify({code: __code}))
    }

    return Promise.resolve();
  }
}
