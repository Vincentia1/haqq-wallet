import React, {useMemo} from 'react';

import {RouteProp} from '@react-navigation/core/lib/typescript/src/types';

import {Color, getColor} from '@app/colors';
import {Icon, IconsName} from '@app/components/ui';
import {RootStackParamList} from '@app/types';

export type HomeScreenTabBarIconProps = {
  route: RouteProp<RootStackParamList>;
  focused: boolean;
};

export const HomeScreenTabBarIcon = ({
  focused,
  route,
}: HomeScreenTabBarIconProps) => {
  const name = useMemo(() => {
    switch (route.name) {
      case 'homeFeed':
        return IconsName.wallet;
      case 'homeSettings':
        return IconsName.settings;
    }
  }, [route.name]);

  if (!name) {
    return null;
  }

  return (
    <Icon
      s
      name={name}
      color={getColor(focused ? Color.graphicGreen1 : Color.graphicBase2)}
    />
  );
};