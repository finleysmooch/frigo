import { ComponentType } from 'react';
import {
  ComfortIcon,
  FreshLightIcon,
  ImpressiveIcon,
  QuickIcon,
  MealPrepIcon,
  CrowdPleaserIcon,
  AdventurousIcon,
  ProjectIcon,
} from '../components/icons/vibe';

type VibeIconComponent = ComponentType<{ size?: number; color?: string }>;

export const VIBE_TAG_ICONS: Record<string, VibeIconComponent> = {
  'comfort':        ComfortIcon,
  'fresh & light':  FreshLightIcon,
  'impressive':     ImpressiveIcon,
  'quick':          QuickIcon,
  'meal prep':      MealPrepIcon,
  'crowd pleaser':  CrowdPleaserIcon,
  'adventurous':    AdventurousIcon,
  'project':        ProjectIcon,
};
