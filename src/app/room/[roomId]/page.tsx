'use client'

import { useUsername } from "@/hooks/use-username";
import { client } from "@/lib/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useParams, useRouter } from "next/navigation"
import { useEffect, useRef, useState } from "react";
import { format } from "date-fns"
import { useRealtime } from "@/lib/realtime-client";
import toast from "react-hot-toast";

function formatTimeRemaining(seconds: number) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return `${mins}:${secs.toString().padStart(2, "0")}`
}

const RoomIdPage = () => {
  const { roomId } = useParams<{ roomId: string }>();
  const [copyStatus, setCopyStatus] = useState<string | null>('COPY');
  const [input, setInput] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { username } = useUsername();
  const router = useRouter();
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined);

  const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
  const { data: ttlData } = useQuery({
    queryKey: ["ttl", roomId],
    queryFn: async () => {
      const res = await client.room.ttl.get({ query: { roomId } });
      return res.data
    }
  })

  useEffect(() => {
    if (ttlData?.ttl !== undefined) {
      setTimeRemaining(ttlData.ttl)
    }
  }, [ttlData])
  useEffect(() => {
    if (timeRemaining === null || timeRemaining < 0) return;

    if (timeRemaining === 0) {
      router.push("/?destroyed=true")
    }

    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev === null || prev <= 1) {
          clearInterval(interval);
          return 0
        }
        return prev - 1
      })
    }, 1000);

    return () => clearInterval(interval)
  }, [timeRemaining, router])


  const { data: messages, isPending: messagesLoading, refetch } = useQuery({
    queryKey: ['messages', roomId],
    queryFn: async () => {
      const res = await client.messages.get({ query: { roomId } });
      return res.data
    }
  })
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const { mutate: sendMessage, isPending } = useMutation({
    mutationFn: async ({ text }: { text: string }) => {
      await client.messages.post({ sender: username, text }, { query: { roomId } });
      setInput("")
    }
  });

  const { mutate: destroyRoom } = useMutation({
    mutationFn: async () => {
      await client.room.delete(null, { query: { roomId } })
    },
    onSuccess: () => {
      toast("Room Deleted!", {
        icon: "🗑️",
        style: {
          background: "#ff3b30",
          color: "white",
          borderRadius: "10px",
          padding: "12px 16px",
          fontWeight: "600",
          boxShadow: "0 4px 12px rgba(255, 0, 0, 0.3)"
        }
      });

    }
  })

  useRealtime({
    channels: [roomId],
    events: ["chat.message", "chat.destroy", "chat.typing"],
    onData: ({ event, data }) => {
      if (event === "chat.message") {
        refetch()
      }

      if (event === "chat.destroy") {
        router.push('/?destroyed=true')
      }

      if (event === "chat.typing") {
        const typingData = data as { sender: string; isTyping: boolean };
        if (typingData.sender !== username) {
          setTypingUsers((prev) => {
            const newSet = new Set(prev);
            if (typingData.isTyping) {
              newSet.add(typingData.sender);
            } else {
              newSet.delete(typingData.sender);
            }
            return newSet;
          });
        }
      }
    }
  })

  function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
    setCopyStatus("COPIED")
    setTimeout(() => setCopyStatus("COPY"), 2000)
  }

  async function handleTyping() {
    // Emit typing event
    await fetch(`/api/realtime/typing?roomId=${roomId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: username, isTyping: true })
    });

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set timeout to stop typing indicator after 2 seconds
    typingTimeoutRef.current = setTimeout(async () => {
      await fetch(`/api/realtime/typing?roomId=${roomId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sender: username, isTyping: false })
      });
    }, 2000);
  }


  return (
    <main className="flex flex-col h-screen max-h-screen overflow-hidden">
      <header className="border-b border-zinc-800 py-4 md:px-20 flex flex-col  md:flex-row items-center justify-between bg-zinc-900/30">

        <div className="flex items-center flex-col md:flex-row md:gap-4 gap-1">
          <section className="flex flex-col items-center md:items-start">
            <span className="text-xs text-zinc-500 uppercase">Room ID</span>
            <div className="flex items-center gap-3">
              <span className="font-bold text-green-500">{roomId}</span>
              <button
                onClick={copyLink}
                className={`text-[15px] px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer ${copyStatus === 'COPIED'
                  ? '  text-green-500 bg-zinc-800'
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200'
                  }`}
              >
                {copyStatus === 'COPIED' && <span>✓</span>}
                {copyStatus}
              </button>
            </div>
          </section>

          <section className="h-8 w-px hidden md:block bg-zinc-800" />

          <section className="flex flex-col">
            <span className="text-xs text-zinc-500 uppercase">Self-Destruct</span>
            <span className={`text-sm font-bold flex items-center gap-2 
              ${timeRemaining !== null && timeRemaining < 60 ? "text-red-500" : "text-amber-500"}`}
            >
              {timeRemaining !== null ? formatTimeRemaining(timeRemaining) : "--:--"}
            </span>
          </section>
        </div>

        <button className="text-xs bg-zinc-800 hover:bg-red-600 cursor-pointer px-3 py-1.5 rounded text-zinc-400 hover:text-white font-bold transition-all group flex items-center gap-2 disabled:opacity-50" onClick={() => destroyRoom()}>
          <span className="group-hover:animate-pulse">💣</span>DESTROY NOW
        </button>

      </header>

      <section className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {
          messages?.messages.length === 0 && (
            <div className="flex items-center justify-center h-full">
              <p className="text-zinc-600 text-sm font-mono">
                No messages yet, start the conversation
              </p>
            </div>
          )
        }

        {
          messages?.messages.map((msg) => {
            const isMyMessage = msg.sender === username;
            return (
              <div
                className={`flex lg:px-40 md:px-6 flex-col ${isMyMessage ? 'items-end' : 'items-start'}`}
                key={msg.id}
              >
                <div className="max-w-[70%] group">
                  <div className={`flex items-baseline gap-2 mb-1 ${isMyMessage ? 'flex-row-reverse' : ''}`}>
                    <span className={`text-xs font-bold ${isMyMessage ? "text-green-400" : "text-blue-400"}`}>
                      {isMyMessage ? "YOU" : msg.sender}
                    </span>
                    <span className="text-[10px] text-zinc-500">
                      {format(msg.timestamp, "HH:mm")}
                    </span>
                  </div>

                  <div className={`rounded-2xl px-4 py-2.5 ${isMyMessage
                      ? 'bg-green-400/60 text-white rounded-tr-none'
                      : 'bg-zinc-800 text-zinc-100 rounded-tl-none'
                    }`}>
                    <p className="text-sm leading-relaxed wrap-break-word">
                      {msg.text}
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        }

        {typingUsers.size > 0 && (
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex gap-1">
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-zinc-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-zinc-500">
              {Array.from(typingUsers)[0]} is typing...
            </span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </section>

      <section className="py-4 border-t border-zinc-800 bg-zinc-900/30 px-20 ">
        <div className="flex gap-4">
          <div className="flex-1 relative group">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-green-500 animate-pulse">{">"}</span>
            <input
              type="text"
              autoFocus
              value={input}
              onKeyDown={(e) => {
                if (e.key === "Enter" && input.trim()) {
                  sendMessage({ text: input })
                  inputRef.current?.focus();
                  // Stop typing indicator on send
                  if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                  }
                  fetch(`/api/realtime/typing?roomId=${roomId}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ sender: username, isTyping: false })
                  });
                }
              }}
              onChange={(e) => {
                setInput(e.target.value);
                if (e.target.value.length > 0) {
                  handleTyping();
                }
              }}
              placeholder="Type message..."
              className="w-full bg-black border border-zinc-800 focus:border-zinc-700 focus:outline-none transition-colors text-zinc-100 placeholder:text-zinc-700 py-3 pl-8 pr-4 text-sm"
            />
          </div>
          <button
            className="bg-zinc-800 text-zinc-400 px-6 text-sm font-bold hover:text-zinc-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            onClick={() => sendMessage({ text: input })}
          >
            {isPending ? "Sending..." : "SEND"}
          </button>
        </div>
      </section>
    </main>
  )
}


export default RoomIdPage