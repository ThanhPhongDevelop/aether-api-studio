import type { Request, Response } from 'express';
import type { ProductInput, ProductListQuery, ProductPatch } from '../models/product.model.js';
import * as productService from '../services/product.service.js';
import { sendSuccess } from '../utils/http-response.js';
import { requireUser, validated } from '../utils/request.js';

const idOf = (res: Response) => validated<{ id: number }>(res, 'params').id;
const visibility = (req: Request) => ({ canSeeInactive: req.user?.role === 'ADMIN' });

export async function list(req: Request, res: Response) {
  const { items, meta } = await productService.listProducts(validated<ProductListQuery>(res, 'query'), visibility(req));
  sendSuccess(res, items, { meta: { ...meta } });
}

export async function categories(_req: Request, res: Response) {
  sendSuccess(res, await productService.listCategories());
}

export async function get(req: Request, res: Response) {
  sendSuccess(res, await productService.getProduct(idOf(res), visibility(req)));
}

export async function create(req: Request, res: Response) {
  const product = await productService.createProduct(validated<ProductInput>(res, 'body'), requireUser(req).id);
  sendSuccess(res, product, { status: 201 });
}

export async function replace(_req: Request, res: Response) {
  sendSuccess(res, await productService.replaceProduct(idOf(res), validated<ProductInput>(res, 'body')));
}

export async function update(_req: Request, res: Response) {
  sendSuccess(res, await productService.updateProduct(idOf(res), validated<ProductPatch>(res, 'body')));
}

export async function remove(_req: Request, res: Response) {
  sendSuccess(res, await productService.deleteProduct(idOf(res)));
}
