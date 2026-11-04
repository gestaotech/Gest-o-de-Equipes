import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();

    const notifications = await prisma.notification.findMany({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    const unreadCount = await prisma.notification.count({
      where: {
        organizationId: scope.orgId,
        userId: session.sub,
        readAt: null,
      },
    });

    return NextResponse.json({ notifications, unreadCount });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const body = await request.json();
    const { notificationId, readAll } = body;

    if (readAll) {
      await prisma.notification.updateMany({
        where: {
          organizationId: scope.orgId,
          userId: session.sub,
          readAt: null,
        },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    if (notificationId) {
      const notification = await prisma.notification.findFirst({
        where: {
          id: notificationId,
          organizationId: scope.orgId,
          userId: session.sub,
        },
      });
      if (!notification) {
        return NextResponse.json(
          { error: "Notificação não encontrada." },
          { status: 404 }
        );
      }
      await prisma.notification.update({
        where: { id: notificationId },
        data: { readAt: new Date() },
      });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json(
      { error: "Parâmetros inválidos." },
      { status: 400 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { searchParams } = new URL(request.url);
    const notificationId = searchParams.get("id");

    if (!notificationId) {
      return NextResponse.json(
        { error: "ID da notificação é obrigatório." },
        { status: 400 }
      );
    }

    const notification = await prisma.notification.findFirst({
      where: {
        id: notificationId,
        organizationId: scope.orgId,
        userId: session.sub,
      },
    });
    if (!notification) {
      return NextResponse.json({ error: "Não encontrada." }, { status: 404 });
    }

    await prisma.notification.delete({
      where: { id: notificationId },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Erro interno." },
      { status: error.statusCode ?? 500 }
    );
  }
}
