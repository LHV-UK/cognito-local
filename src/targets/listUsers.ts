import {
  type AttributeType,
  ListUsersRequest,
  ListUsersResponse,
} from "aws-sdk/clients/cognitoidentityserviceprovider";
import { Services } from "../services";
import { userToResponseObject } from "./responses";
import { Target } from "./Target";

export type ListUsersTarget = Target<ListUsersRequest, ListUsersResponse>;

const getAttribute = (
  attributes: AttributeType[] | undefined,
  attributeName: string
): string | undefined => {
  const attribute = (attributes || []).find((a) => a.Name === attributeName);
  return attribute ? attribute.Value : undefined;
};

export const ListUsers =
  ({ cognito }: Pick<Services, "cognito">): ListUsersTarget =>
  async (ctx, req) => {
    const userPool = await cognito.getUserPool(ctx, req.UserPoolId);
    const users = await userPool.listUsers(ctx);

    const [attr, value] = req.Filter?.split("=") || [null, null];
    const transformedValue = value ? value.replace(/"/g, "") : value;

    const filteredUsers = users.filter((user) => {
      if (!attr) return true;
      return getAttribute(user.Attributes, attr) === transformedValue;
    });

    // TODO: support AttributesToGet
    // TODO: support PaginationToken

    const limit = req.Limit || filteredUsers.length;

    return {
      Users: filteredUsers.map(userToResponseObject).slice(0, limit),
    };
  };
