import {
  RespondToAuthChallengeRequest,
  RespondToAuthChallengeResponse,
} from "aws-sdk/clients/cognitoidentityserviceprovider";
import {
  CodeMismatchError,
  InvalidParameterError,
  NotAuthorizedError,
  UnsupportedError,
} from "../errors";
import { Services } from "../services";
import { generateTokens } from "../services/tokens";

export type RespondToAuthChallengeTarget = (
  req: RespondToAuthChallengeRequest
) => Promise<RespondToAuthChallengeResponse>;

type RespondToAuthChallengeService = Pick<
  Services,
  "clock" | "cognito" | "config" | "triggers"
>;

export const RespondToAuthChallenge =
  ({
    clock,
    cognito,
    config,
    triggers,
  }: RespondToAuthChallengeService): RespondToAuthChallengeTarget =>
  async (req) => {
    if (!req.ChallengeResponses) {
      throw new InvalidParameterError(
        "Missing required parameter challenge responses"
      );
    }
    if (!req.ChallengeResponses.USERNAME) {
      throw new InvalidParameterError("Missing required parameter USERNAME");
    }
    if (!req.Session) {
      throw new InvalidParameterError("Missing required parameter Session");
    }

    const userPool = await cognito.getUserPoolForClientId(req.ClientId);
    const user = await userPool.getUserByUsername(
      req.ChallengeResponses.USERNAME
    );
    if (!user) {
      throw new NotAuthorizedError();
    }

    if (req.ChallengeName === "SMS_MFA") {
      if (user.MFACode !== req.ChallengeResponses.SMS_MFA_CODE) {
        throw new CodeMismatchError();
      }

      await userPool.saveUser({
        ...user,
        MFACode: undefined,
        UserLastModifiedDate: clock.get(),
      });
    } else if (req.ChallengeName === "NEW_PASSWORD_REQUIRED") {
      if (!req.ChallengeResponses.NEW_PASSWORD) {
        throw new InvalidParameterError(
          "Missing required parameter NEW_PASSWORD"
        );
      }

      // TODO: validate the password?
      await userPool.saveUser({
        ...user,
        Password: req.ChallengeResponses.NEW_PASSWORD,
        UserLastModifiedDate: clock.get(),
        UserStatus: "CONFIRMED",
      });
    } else {
      throw new UnsupportedError(
        `respondToAuthChallenge with ChallengeName=${req.ChallengeName}`
      );
    }

    if (triggers.enabled("PostAuthentication")) {
      await triggers.postAuthentication({
        clientId: req.ClientId,
        clientMetadata: req.ClientMetadata,
        source: "PostAuthentication_Authentication",
        userAttributes: user.Attributes,
        username: user.Username,
        userPoolId: userPool.config.Id,
      });
    }

    return {
      ChallengeParameters: {},
      AuthenticationResult: generateTokens(
        user,
        req.ClientId,
        userPool.config.Id,
        config.TokenConfig,
        clock
      ),
    };
  };
