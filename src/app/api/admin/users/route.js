import { UserController } from '@/controllers/UserController';

export async function GET() {
  return UserController.getAllUsers();
}

export async function POST(request) {
  return UserController.createUser(request);
}

export async function PUT(request) {
  return UserController.updateUser(request);
}

export async function DELETE(request) {
  return UserController.deleteUser(request);
}
