import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/auth';
import { AdminModel } from '@/models/Admin';

export class UserController {
  static async getAllUsers() {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      const users = await AdminModel.getAll();
      return NextResponse.json({
        success: true,
        users
      });
    } catch (error) {
      console.error('UserController getAllUsers error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async createUser(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      if (session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can create users.' },
          { status: 403 }
        );
      }

      const { username, password, name, role, modules, phone, isActive } = await request.json();

      if (!username || !password || !name) {
        return NextResponse.json(
          { error: 'Username, password, and name are required.' },
          { status: 400 }
        );
      }

      // Check if username already exists
      const existing = await AdminModel.getByUsername(username.trim());
      if (existing) {
        return NextResponse.json(
          { error: `Username "${username.trim()}" is already taken.` },
          { status: 400 }
        );
      }

      const user = await AdminModel.create({
        username,
        password,
        name,
        role: role || 'employee',
        modules: Array.isArray(modules) ? modules : ['crm', 'itinerary'],
        phone,
        isActive: isActive !== undefined ? isActive : true
      });

      return NextResponse.json({
        success: true,
        user
      });
    } catch (error) {
      console.error('UserController createUser error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async updateUser(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      if (session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can modify users and permissions.' },
          { status: 403 }
        );
      }

      const { id, name, username, password, role, modules, phone, isActive } = await request.json();

      if (!id) {
        return NextResponse.json(
          { error: 'User ID is required.' },
          { status: 400 }
        );
      }

      // Check if username changed and conflicts
      if (username) {
        const existing = await AdminModel.getByUsername(username.trim());
        if (existing && existing.id !== parseInt(id, 10)) {
          return NextResponse.json(
            { error: `Username "${username.trim()}" is already in use by another user.` },
            { status: 400 }
          );
        }
      }

      const updated = await AdminModel.update(parseInt(id, 10), {
        name,
        username,
        password,
        role,
        modules,
        phone,
        isActive
      });

      return NextResponse.json({
        success: true,
        user: updated
      });
    } catch (error) {
      console.error('UserController updateUser error:', error);
      return NextResponse.json(
        { error: error.message || 'Internal server error' },
        { status: 500 }
      );
    }
  }

  static async deleteUser(request) {
    try {
      const session = await getAdminSession();
      if (!session) {
        return NextResponse.json(
          { error: 'Unauthorized. Please log in as admin.' },
          { status: 401 }
        );
      }

      if (session.role !== 'admin') {
        return NextResponse.json(
          { error: 'Forbidden: Only administrators can delete users.' },
          { status: 403 }
        );
      }

      const { searchParams } = new URL(request.url);
      const id = searchParams.get('id');

      if (!id) {
        return NextResponse.json(
          { error: 'User ID is required.' },
          { status: 400 }
        );
      }

      const userIdNum = parseInt(id, 10);

      // Prevent self-deletion
      if (session.adminId === userIdNum) {
        return NextResponse.json(
          { error: 'You cannot delete your own logged-in admin account.' },
          { status: 400 }
        );
      }

      const deleted = await AdminModel.delete(userIdNum);
      if (!deleted) {
        return NextResponse.json(
          { error: 'User not found.' },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        message: 'User deleted successfully.'
      });
    } catch (error) {
      console.error('UserController deleteUser error:', error);
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }
}
