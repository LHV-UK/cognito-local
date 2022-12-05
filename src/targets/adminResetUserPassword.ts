import {
  AdminResetUserPasswordRequest,
  AdminResetUserPasswordResponse,
} from "aws-sdk/clients/cognitoidentityserviceprovider";
import shortUUID from "short-uuid";
import { UserNotFoundError } from "../errors";
import { Services } from "../services";
import { Target } from "./Target";
import { InvalidParameterError } from "../errors";
import { Messages, UserPoolService } from "../services";
import { Context } from "../services/context";
import { User } from "../services/userPoolService";
import { selectAppropriateDeliveryMethod } from "../services/messageDelivery/deliveryMethod";

export type AdminResetUserPasswordTarget = Target<
  AdminResetUserPasswordRequest,
  AdminResetUserPasswordResponse
>;

type AdminResetUserPasswordServices = Pick<
  Services,
  "cognito" | "clock" | "messages"
>;

const generator = shortUUID(
  "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!"
);

const sendCode = async (
  ctx: Context,
  req: AdminResetUserPasswordRequest,
  code: string,
  user: User,
  messages: Messages,
  userPool: UserPoolService
) => {
  const deliveryDetails = selectAppropriateDeliveryMethod(["email"], user);
  if (!deliveryDetails) {
    // TODO: I don't know what the real error message should be for this
    throw new InvalidParameterError(
      "User has no attribute matching desired delivery mediums"
    );
  }

  await messages.deliver(
    ctx,
    "Authentication",
    null,
    userPool.options.Id,
    user,
    code,
    req.ClientMetadata,
    deliveryDetails
  );
};

export const AdminResetUserPassword =
  ({
    cognito,
    clock,
    messages,
  }: AdminResetUserPasswordServices): AdminResetUserPasswordTarget =>
  async (ctx, req) => {
    const userPool = await cognito.getUserPool(ctx, req.UserPoolId);
    const user = await userPool.getUserByUsername(ctx, req.Username);
    if (!user) {
      throw new UserNotFoundError();
    }

    const code = generator.uuid().slice(0, 6);

    const newUser = {
      ...user,
      UserStatus: "RESET_REQUIRED",
      ConfirmationCode: code,
      UserLastModifiedDate: clock.get(),
    };

    await userPool.saveUser(ctx, newUser);

    await sendCode(ctx, req, code, newUser, messages, userPool);

    return {};
  };
