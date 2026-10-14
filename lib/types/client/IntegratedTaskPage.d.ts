import type { ComponentType } from 'react';
import type { TaskNavigation } from './task-navigation.ts';
export declare function IntegratedTaskPage({ navigation, official, officialProps }: {
    navigation: TaskNavigation;
    official: ComponentType<any>;
    officialProps: any;
}): import("react").DetailedReactHTMLElement<{
    className: string;
    'data-automation-integrated': boolean;
    'aria-label': string;
}, HTMLElement>;
