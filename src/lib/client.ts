import { treaty } from "@elysiajs/eden";
import type { App } from "@/app/api/[[...slugs]]/route";

const baseClient = treaty<App>(
  typeof window !== 'undefined' 
    ? window.location.origin 
    : 'http://localhost:3000'
);

export const client = baseClient.api;