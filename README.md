
# JK Tyre Backend (Node + Express + MongoDB)

## Setup
```bash
npm install
cp .env.example .env
# edit .env to set MONGO_URI if needed
npm run dev
```

## API
- POST `/api/auth/send-otp` { mobile }
- POST `/api/auth/verify-otp` { mobile, code } (demo code: 123456)
- POST `/api/prospect/upload` (form-data: file)
- POST `/api/prospect/createOnBoard` (JSON: mobile, fullName, shopName, address, upi, files[])
- POST `/api/prospect/generate-paymentLink` (JSON: upi) -> { url }
