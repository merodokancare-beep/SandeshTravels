import { AuthController } from '@/controllers/AuthController';

export async function POST(request) {
  return AuthController.partnerLogout(request);
}
