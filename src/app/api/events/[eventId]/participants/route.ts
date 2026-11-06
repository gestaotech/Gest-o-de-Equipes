import { NextRequest, NextResponse } from "next/server";
import { requireSessionApi } from "@/lib/auth";
import { requireDataScope } from "@/server/scope";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/lib/errors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId } = await params;

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    const participants = await prisma.eventParticipant.findMany({
      where: { eventId },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ participants });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId } = await params;
    const body: Record<string, unknown> = await request.json();

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true, userId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    if (event.userId === session.sub) {
      return NextResponse.json(
        { error: "O criador do evento já é o responsável." },
        { status: 400 }
      );
    }

    const existing = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: session.sub } },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Você já é participante deste evento." },
        { status: 409 }
      );
    }

    const participant = await prisma.eventParticipant.create({
      data: {
        eventId,
        userId: session.sub,
        status: "PENDING",
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    return NextResponse.json({ participant }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  try {
    const session = await requireSessionApi();
    const scope = await requireDataScope();
    const { eventId } = await params;

    const participant = await prisma.eventParticipant.findUnique({
      where: { eventId_userId: { eventId, userId: session.sub } },
      select: { id: true },
    });
    if (!participant) {
      return NextResponse.json({ error: "Participação não encontrada." }, { status: 404 });
    }

    const event = await prisma.event.findUnique({
      where: { id: eventId },
      select: { id: true, organizationId: true },
    });
    if (!event || event.organizationId !== scope.orgId) {
      return NextResponse.json({ error: "Evento não encontrado." }, { status: 404 });
    }

    await prisma.eventParticipant.delete({
      where: { id: participant.id },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erro interno.";
    const statusCode = error instanceof AppError ? error.status : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
