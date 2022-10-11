import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useApp} from '../contexts/app';
import {useContacts} from '../contexts/contacts';
import {utils} from 'ethers';
import {
  Button,
  ButtonVariant,
  CloseCircle,
  IconButton,
  Input,
  KeyboardSafeArea,
  QRScanner,
  Spacer,
  Text,
} from './ui';
import {GRAPHIC_BASE_2, GRAPHIC_GREEN_1, TEXT_RED_1} from '../variables';
import {FlatList, StyleSheet} from 'react-native';
import {AddressRow} from './address-row';
import {AddressHeader} from './address-header';
import {isHexString} from '../utils';

export type TransactionAddressProps = {
  initial?: string;
  onAddress: (address: string) => void;
};

export const TransactionAddress = ({
  initial = '',
  onAddress,
}: TransactionAddressProps) => {
  const app = useApp();
  const contacts = useContacts();
  const [address, setAddress] = useState(initial);
  const [error, setError] = useState(false);
  const contactsList = contacts.getContacts();
  const checked = useMemo(() => utils.isAddress(address.trim()), [address]);

  useEffect(() => {
    const toTrim = address.trim();

    if (toTrim.length >= 2 && !toTrim.startsWith('0x')) {
      return setError(true);
    }

    if (toTrim.length > 2 && !isHexString(toTrim)) {
      return setError(true);
    }

    if (toTrim.length < 42) {
      return setError(false);
    }

    if (!utils.isAddress(toTrim.trim())) {
      return setError(true);
    }

    setError(false);
  }, [address]);

  const onDone = useCallback(async () => {
    onAddress(address.trim());
  }, [onAddress, address]);

  const onPressQR = useCallback(() => {
    const subscription = (value: string) => {
      if (utils.isAddress(value.trim())) {
        setAddress(value.trim());
        app.off('address', subscription);
        app.emit('modal', null);
      }
    };

    app.on('address', subscription);

    app.emit('modal', {type: 'qr'});
  }, [app]);

  const onPressClear = useCallback(() => {
    setAddress('');
  }, []);

  return (
    <KeyboardSafeArea>
      <Input
        label="Send to"
        style={page.input}
        placeholder="Enter Address or contact name"
        onChangeText={setAddress}
        value={address}
        error={error}
        multiline={true}
        autoFocus={true}
        rightAction={
          address === '' ? (
            <IconButton onPress={onPressQR}>
              <QRScanner color={GRAPHIC_GREEN_1} width={20} height={20} />
            </IconButton>
          ) : (
            <IconButton onPress={onPressClear}>
              <CloseCircle color={GRAPHIC_BASE_2} width={20} height={20} />
            </IconButton>
          )
        }
      />
      {error && (
        <Text t14 style={page.t14}>
          Incorrect address
        </Text>
      )}
      <Spacer>
        {contactsList.length ? (
          <FlatList
            data={contactsList}
            renderItem={({item}) => (
              <AddressRow item={item} onPress={setAddress} />
            )}
            ListHeaderComponent={AddressHeader}
          />
        ) : null}
      </Spacer>
      <Button
        disabled={!checked}
        variant={ButtonVariant.contained}
        title="Continue"
        onPress={onDone}
        style={page.button}
      />
    </KeyboardSafeArea>
  );
};

const page = StyleSheet.create({
  input: {
    marginBottom: 12,
    marginHorizontal: 20,
  },
  button: {
    marginHorizontal: 20,
    marginVertical: 16,
  },
  t14: {color: TEXT_RED_1, marginHorizontal: 20},
});