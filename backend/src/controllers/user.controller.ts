import type { Request, Response } from 'express';
import type { CreateUserInput, UpdateUserInput, UserListQuery } from '../models/user.model.js';
import * as userService from '../services/user.service.js';
import { sendSuccess } from '../utils/http-response.js';
import { requireUser, validated } from '../utils/request.js';

const idOf = (res: Response) => validated<{ id: number }>(res, 'params').id;

export async function list(_req: Request, res: Response) {
  const { items, meta } = await userService.listUsers(validated<UserListQuery>(res, 'query'));
  sendSuccess(res, items, { meta: { ...meta } });
}

export async function get(_req: Request, res: Response) {
  sendSuccess(res, await userService.getUser(idOf(res)));
}

export async function create(_req: Request, res: Response) {
  sendSuccess(res, await userService.createUser(validated<CreateUserInput>(res, 'body')), { status: 201 });
}

export async function update(req: Request, res: Response) {
  sendSuccess(res, await userService.updateUser(idOf(res), validated<UpdateUserInput>(res, 'body'), requireUser(req)));
}

export async function remove(req: Request, res: Response) {
  sendSuccess(res, await userService.deleteUser(idOf(res), requireUser(req)));
}
