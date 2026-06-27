import type {ComponentType} from 'react';

export type DemoMetadata = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  route: string;
  instructions?: string[];
};

export type DemoDefinition = DemoMetadata & {
  Component: ComponentType;
};
