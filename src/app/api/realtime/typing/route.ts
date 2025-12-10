import { realtime } from "@/lib/realtime";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const roomId = searchParams.get('roomId');

    if (!roomId) {
      return NextResponse.json({ error: 'Room ID required' }, { status: 400 });
    }

    const body = await req.json();
    const { sender, isTyping } = body;

    if (!sender || typeof isTyping !== 'boolean') {
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 });
    }

    // Emit typing event to the room
    await realtime.channel(roomId).emit("chat.typing", { sender, isTyping });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Typing event error:', error);
    return NextResponse.json({ error: 'Failed to emit typing event' }, { status: 500 });
  }
}
