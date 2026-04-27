# Configuração necessária no projeto

## 1. tailwind.config.ts — adicionar animação

Dentro de `theme.extend`, adicione:

```ts
// tailwind.config.ts
export default {
  // ...
  theme: {
    extend: {
      keyframes: {
        "fade-in": {
          from: { opacity: "0", transform: "translateX(-8px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "fade-in": "fade-in 0.2s ease",
      },
    },
  },
};
```

## 2. globals.css — scrollbar styling

```css
/* Scrollbar para a sidebar */
.scrollbar-thin::-webkit-scrollbar {
  width: 4px;
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.08);
  border-radius: 4px;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.15);
}
```

## 3. Estrutura de arquivos

```
src/
├── app/
│   ├── (auth)/
│   │   └── login/
│   │       └── page.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx          ← layout.tsx (usa o Sidebar)
│   │   ├── dashboard/
│   │   │   └── page.tsx
│   │   ├── os/
│   │   │   ├── page.tsx
│   │   │   ├── kanban/
│   │   │   │   └── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── cadastros/
│   │   │   ├── page.tsx
│   │   │   └── [id]/
│   │   │       └── page.tsx
│   │   ├── financeiro/
│   │   │   ├── page.tsx
│   │   │   ├── lancamentos/
│   │   │   ├── plano-contas/
│   │   │   ├── contas-pagar/
│   │   │   └── contas-receber/
│   │   ├── rh/
│   │   │   ├── page.tsx
│   │   │   ├── colaboradores/
│   │   │   ├── ponto/
│   │   │   ├── metas/
│   │   │   ├── vales/
│   │   │   └── folha/
│   │   └── configuracoes/
│   │       └── page.tsx
│   └── layout.tsx              ← root layout (fonts, etc)
├── components/
│   └── layout/
│       └── Sidebar.tsx         ← Sidebar.tsx
```

## 4. Dependência

```bash
npm install lucide-react
```

Montserrat via Google Fonts — adicione no root layout:

```tsx
// app/layout.tsx
import { Montserrat } from "next/font/google";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body className={`${montserrat.variable} font-sans`}>
        {children}
      </body>
    </html>
  );
}
```

E no `tailwind.config.ts`:

```ts
theme: {
  extend: {
    fontFamily: {
      sans: ["var(--font-montserrat)", "Montserrat", "sans-serif"],
    },
  },
}
```
