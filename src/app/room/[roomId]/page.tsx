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
  const { username } = useUsername();
  const router = useRouter();

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
    events: ["chat.message", "chat.destroy"],
    onData: ({ event }) => {
      if (event === "chat.message") {
        refetch()
      }

      if (event === "chat.destroy") {
        router.push('/?destroyed=true')
      }
    }
  })

  function copyLink() {
    const url = window.location.href;
    navigator.clipboard.writeText(url)
    setCopyStatus("COPIED")
    setTimeout(() => setCopyStatus("COPY"), 2000)
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
          messages?.messages.map((msg) => (
            <div className="flex flex-col items-start" key={msg.id}>
              <div className="max-w-[80%] group">
                <div className="flex items-baseline gap-3 mb-1">
                  <span className={`text-xs font-bold ${msg.sender === username ? "text-green-500" : "text-blue-500"}`}>
                    {msg.sender === username ? "YOU" : msg.sender}
                  </span>

                  <span className="text-[10px] text-zinc-600">
                    {format(msg.timestamp, "HH:mm")}
                  </span>
                </div>

                <p className="text-sm text-zinc-300 leading-relaxed break-all">
                  {msg.text}
                </p>
              </div>
            </div>
          ))
        }
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
                }
              }}
              onChange={(e) => setInput(e.target.value)}
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