import { loadConfig } from './config';
import { chat as aiChat, AIMessage } from './aiprovider';

export interface SuggestionResult {
  template: string;
  uiKit: 'tailwind' | 'shadcn' | 'material' | 'chakra';
  envPreset: 'dev' | 'production' | 'indie-saas';
  structure: 'monorepo' | 'polyrepo';
  confidence: 'high' | 'medium' | 'low';
  reason: string;
}

export interface AISuggestionResult extends SuggestionResult {
  aiModel: string;
}

/**
 * Rule-based instant suggestion from project name + description keywords.
 */
export function suggestFromRules(projectName: string, description?: string): SuggestionResult {
  const text = `${projectName} ${description || ''}`.toLowerCase();

  // Mobile / Flutter
  if (/\b(mobile|app|flutter|ios|android)\b/.test(text)) {
    return {
      template: 'flutter-firebase',
      uiKit: 'tailwind',
      envPreset: 'dev',
      structure: 'monorepo',
      confidence: 'high',
      reason: 'Project name suggests a mobile app → Flutter + Firebase',
    };
  }

  // API / Backend / Microservice
  if (/\b(api|backend|microservice|server|service)\b/.test(text)) {
    const isGo = /\b(go|golang|gin)\b/.test(text);
    return {
      template: isGo ? 'go-gin-react' : 'fastapi-react',
      uiKit: 'tailwind',
      envPreset: 'production',
      structure: 'monorepo',
      confidence: 'high',
      reason: isGo
        ? 'Backend/API project with Go keywords → Go Gin + React'
        : 'Backend/API project → FastAPI + React',
    };
  }

  // Dashboard / Admin / Portal
  if (/\b(dashboard|admin|portal|panel|cms|manage)\b/.test(text)) {
    return {
      template: 'nextjs-app-router',
      uiKit: 'shadcn',
      envPreset: 'production',
      structure: 'monorepo',
      confidence: 'high',
      reason: 'Dashboard/admin project → Next.js App Router + shadcn',
    };
  }

  // SaaS / Startup / MVP
  if (/\b(saas|startup|mvp|subscription|billing)\b/.test(text)) {
    return {
      template: 'react-express-mongo',
      uiKit: 'shadcn',
      envPreset: 'indie-saas',
      structure: 'monorepo',
      confidence: 'high',
      reason: 'SaaS/startup project → React + Express + MongoDB with indie-saas preset',
    };
  }

  // Blog / CMS / Content
  if (/\b(blog|cms|content|article|post|news)\b/.test(text)) {
    return {
      template: 'nextjs-app-router',
      uiKit: 'tailwind',
      envPreset: 'dev',
      structure: 'monorepo',
      confidence: 'high',
      reason: 'Content/blog project → Next.js App Router',
    };
  }

  // E-commerce / Shop / Store
  if (/\b(ecommerce|e-commerce|shop|store|cart|product|marketplace)\b/.test(text)) {
    return {
      template: 'react-express-postgres',
      uiKit: 'shadcn',
      envPreset: 'production',
      structure: 'monorepo',
      confidence: 'high',
      reason: 'E-commerce project → React + Express + Postgres with Stripe',
    };
  }

  // Rust
  if (/\b(rust|actix|wasm)\b/.test(text)) {
    return {
      template: 'rust-actix-react',
      uiKit: 'tailwind',
      envPreset: 'production',
      structure: 'monorepo',
      confidence: 'medium',
      reason: 'Rust keywords detected → Rust Actix + React',
    };
  }

  // Django / Python
  if (/\b(django|python|drf)\b/.test(text)) {
    return {
      template: 'django-react',
      uiKit: 'tailwind',
      envPreset: 'dev',
      structure: 'monorepo',
      confidence: 'medium',
      reason: 'Python/Django keywords → Django + React',
    };
  }

  // Next.js specific
  if (/\b(next|nextjs|vercel|prisma)\b/.test(text)) {
    return {
      template: 'nextjs-app-router',
      uiKit: 'shadcn',
      envPreset: 'production',
      structure: 'monorepo',
      confidence: 'medium',
      reason: 'Next.js keywords detected → Next.js App Router',
    };
  }

  // Default fallback
  return {
    template: 'react-express-mongo',
    uiKit: 'tailwind',
    envPreset: 'dev',
    structure: 'monorepo',
    confidence: 'low',
    reason: 'No strong keyword match — defaulting to React + Express + MongoDB',
  };
}

/**
 * AI-powered suggestion using Ollama/OpenAI-compatible endpoint.
 */
export async function suggestFromAI(
  projectName: string,
  description?: string
): Promise<AISuggestionResult | { error: string }> {
  const templates = [
    'react-express-mongo',
    'react-express-postgres',
    'nextjs-prisma',
    'nextjs-app-router',
    'flutter-firebase',
    'fastapi-react',
    'go-gin-react',
    'rust-actix-react',
    'django-react',
  ];

  const prompt = `You are a project template advisor. Given a project name and optional description, suggest the best tech stack configuration.

Project name: "${projectName}"
${description ? `Description: "${description}"` : ''}

Available templates: ${templates.join(', ')}
Available UI kits: tailwind, shadcn, material, chakra
Available env presets: dev, production, indie-saas
Available structures: monorepo, polyrepo

Respond with ONLY a JSON object (no markdown, no explanation):
{
  "template": "<template-id>",
  "uiKit": "<ui-kit>",
  "envPreset": "<preset>",
  "structure": "<structure>",
  "reason": "<one-line explanation>"
}`;

  const messages: AIMessage[] = [{ role: 'user', content: prompt }];

  try {
    const result = await aiChat(messages, { temperature: 0.3 });

    if (!result.ok) {
      return { error: result.error || 'AI request failed' };
    }

    const content = result.content;

    if (!content.trim()) {
      return { error: 'AI returned empty response.' };
    }

    // Parse JSON from response (handle markdown code blocks)
    let jsonStr = content.trim();
    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }
    // Also try to find raw JSON object
    const objMatch = jsonStr.match(/\{[\s\S]*\}/);
    if (objMatch) {
      jsonStr = objMatch[0];
    }

    const parsed = JSON.parse(jsonStr) as {
      template?: string;
      uiKit?: string;
      envPreset?: string;
      structure?: string;
      reason?: string;
    };

    // Validate and sanitize
    const validTemplate = templates.includes(parsed.template || '')
      ? (parsed.template as string)
      : 'react-express-mongo';
    const validUiKit = ['tailwind', 'shadcn', 'material', 'chakra'].includes(parsed.uiKit || '')
      ? (parsed.uiKit as 'tailwind' | 'shadcn' | 'material' | 'chakra')
      : 'tailwind';
    const validPreset = ['dev', 'production', 'indie-saas'].includes(parsed.envPreset || '')
      ? (parsed.envPreset as 'dev' | 'production' | 'indie-saas')
      : 'dev';
    const validStructure = ['monorepo', 'polyrepo'].includes(parsed.structure || '')
      ? (parsed.structure as 'monorepo' | 'polyrepo')
      : 'monorepo';

    return {
      template: validTemplate,
      uiKit: validUiKit,
      envPreset: validPreset,
      structure: validStructure,
      confidence: 'high',
      reason: parsed.reason || 'AI recommendation',
      aiModel: result.model,
    };
  } catch (err: any) {
    if (err?.name === 'SyntaxError') {
      return { error: 'AI response was not valid JSON. Try again.' };
    }
    return { error: err?.message || 'AI suggestion failed' };
  }
}
