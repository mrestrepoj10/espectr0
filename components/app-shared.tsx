import type { ReactNode } from "react";
import {
  ActivityIcon,
  BarChart3Icon,
  CircleHelpIcon,
  FileTextIcon,
  MapPinIcon,
  SettingsIcon,
  WavesIcon,
} from "lucide-react";

export type SidebarNavItem = {
  title: string;
  path: string;
  icon: ReactNode;
};

export type SidebarNavGroup = {
  label?: string;
  items: SidebarNavItem[];
};

export const navGroups: SidebarNavGroup[] = [
  {
    label: "Módulos",
    items: [
      {
        title: "Calculadora",
        path: "/calculadora",
        icon: <ActivityIcon />,
      },
      {
        title: "Cortante basal",
        path: "/cortante",
        icon: <BarChart3Icon />,
      },
      {
        title: "Comparador",
        path: "/comparador",
        icon: <WavesIcon />,
      },
      {
        title: "Microzonificación",
        path: "/microzonificacion",
        icon: <MapPinIcon />,
      },
      {
        title: "Memoria PDF",
        path: "/memoria",
        icon: <FileTextIcon />,
      },
    ],
  },
];

export const footerNavLinks: SidebarNavItem[] = [
  {
    title: "Ayuda",
    path: "#ayuda",
    icon: <CircleHelpIcon />,
  },
  {
    title: "Ajustes",
    path: "#ajustes",
    icon: <SettingsIcon />,
  },
];

export const navLinks = [...navGroups.flatMap((group) => group.items), ...footerNavLinks];
