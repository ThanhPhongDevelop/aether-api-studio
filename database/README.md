# database/

Tầng dữ liệu được tách khỏi mã API để schema, migration và dữ liệu mẫu có lịch sử riêng trong git.

| Thư mục                | Nội dung                                            |
| ---------------------- | --------------------------------------------------- |
| `schema/schema.prisma` | Nguồn sự thật duy nhất của mô hình dữ liệu          |
| `migrations/`          | Migration SQL do Prisma sinh — luôn commit          |
| `seed/seed.ts`         | Dữ liệu mẫu idempotent (`seed/data/` chứa nội dung) |

Prisma CLI được cấu hình trong `backend/prisma.config.ts`; mọi lệnh chạy từ thư mục gốc:

```bash
npm run db:migrate -- --name add_tags   # sau khi sửa schema.prisma
npm run db:deploy                       # áp dụng migration chưa chạy
npm run db:seed                         # nạp dữ liệu mẫu (chạy lại thoải mái)
npm run db:reset                        # xoá sạch + migrate + seed
npm run db:studio                       # xem dữ liệu trên trình duyệt
```

Quy ước:

- Tên bảng `snake_case` số nhiều (`@@map`), tên trường `camelCase`.
- Mọi dữ liệu thuộc về người dùng xoá theo chuỗi khi người dùng bị xoá.
- Không sửa migration đã commit; thay đổi schema luôn đi kèm migration mới.
