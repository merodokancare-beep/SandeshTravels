import { TemplateController } from '@/controllers/TemplateController';

export async function GET(request) {
  return TemplateController.getAllTemplates(request);
}

export async function POST(request) {
  return TemplateController.createTemplate(request);
}

export async function PUT(request) {
  return TemplateController.updateTemplate(request);
}

export async function DELETE(request) {
  return TemplateController.deleteTemplate(request);
}
