import { vi } from "vitest";

// Mock next/navigation
const pushMock = vi.fn();
const replaceMock = vi.fn();
const backMock = vi.fn();
const pathnameMock = vi.fn().mockReturnValue("/");
const paramsMock = vi.fn().mockReturnValue({});

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: replaceMock,
    back: backMock,
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  usePathname: pathnameMock,
  useParams: paramsMock,
  useSearchParams: () => new URLSearchParams(),
}));

// Mock next/image → plain <img>
vi.mock("next/image", () => ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  default: ({ fill, priority, ...rest }: Record<string, unknown>) => {
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

// Mock next/link → plain <a>
vi.mock("next/link", () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode;
    href: string;
    [key: string]: unknown;
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

export { pushMock, replaceMock, backMock, pathnameMock, paramsMock };
