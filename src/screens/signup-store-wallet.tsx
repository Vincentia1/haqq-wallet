import React, {useCallback, useEffect} from 'react';

import {ProviderSSSReactNative} from '@haqq/provider-sss-react-native';
import {View} from 'react-native';

import {captureException, showModal} from '@app/helpers';
import {getProviderForNewWallet} from '@app/helpers/get-provider-for-new-wallet';
import {useTypedNavigation, useTypedRoute} from '@app/hooks';
import {I18N, getText} from '@app/i18n';
import {Wallet} from '@app/models/wallet';
import {WalletType} from '@app/types';
import {ETH_HD_SHORT_PATH, MAIN_ACCOUNT_NAME} from '@app/variables/common';

export const SignUpStoreWalletScreen = () => {
  const navigation = useTypedNavigation();
  const route = useTypedRoute<'createStoreWallet'>();

  const goBack = useCallback(() => {
    navigation.reset({
      routes: [{name: 'welcome'}, {name: 'signup', params: {next: 'restore'}}],
    });
  }, [navigation]);

  useEffect(() => {
    showModal('loading', {
      text: getText(I18N.signupStoreWalletCreatingAccount),
    });
  }, []);

  useEffect(() => {
    setTimeout(async () => {
      try {
        const provider = await getProviderForNewWallet(route.params);
        const accountWallets = Wallet.getForAccount(provider.getIdentifier());
        const nextHdPathIndex = accountWallets.reduce((memo, wallet) => {
          const segments = wallet.path?.split('/') ?? ['0'];
          return Math.max(
            memo,
            parseInt(segments[segments.length - 1], 10) + 1,
          );
        }, 0);
        const hdPath = `${ETH_HD_SHORT_PATH}/${nextHdPathIndex}`;
        const name =
          Wallet.getSize() === 0
            ? MAIN_ACCOUNT_NAME
            : getText(I18N.signupStoreWalletAccountNumber, {
                number: `${Wallet.getSize() + 1}`,
              });
        const {address} = await provider.getAccountInfo(hdPath);
        const type =
          provider instanceof ProviderSSSReactNative
            ? WalletType.sss
            : WalletType.mnemonic;
        await Wallet.create(
          {
            address,
            accountId: provider.getIdentifier(),
            path: hdPath,
            type,
          },
          name,
        );
        navigation.navigate(route.params.nextScreen ?? 'onboardingFinish');
      } catch (error) {
        switch (error) {
          case 'wallet_already_exists':
            showModal('errorAccountAdded');
            goBack();
            break;
          default:
            if (error instanceof Error) {
              showModal('errorCreateAccount');
              goBack();
              captureException(error, 'createStoreWallet');
            }
        }
      }
    }, 350);
  }, [goBack, navigation, route.params]);

  return <View />;
};
