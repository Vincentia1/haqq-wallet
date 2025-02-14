import React, {useCallback, useMemo, useState} from 'react';

import {View} from 'react-native';

import {Color} from '@app/colors';
import {EmptyCell} from '@app/components/backup-verify/empty-cell';
import {FilledCell} from '@app/components/backup-verify/filled-cell';
import {
  Button,
  ButtonSize,
  ButtonVariant,
  PopupContainer,
  Spacer,
  Text,
} from '@app/components/ui';
import {createTheme} from '@app/helpers';
import {I18N} from '@app/i18n';
import {HapticEffects, vibrate} from '@app/services/haptic';
import {shuffleWords} from '@app/utils';

export type BackupVerifyProps = {
  error: boolean;
  phrase: string;
  testID?: string;
  onDone: (phrase: string) => void;
};

export const BackupVerify = ({
  error,
  phrase,
  onDone,
  testID,
}: BackupVerifyProps) => {
  const words = useMemo(
    () => new Map(phrase.split(' ').map((value, pos) => [String(pos), value])),
    [phrase],
  );
  const [selected, setSelected] = useState<(string | undefined)[]>([]);
  const buttons = useMemo(() => shuffleWords(words), [words]);

  const onPressDone = useCallback(() => {
    onDone(selected.map(v => words.get(v ?? '') ?? '').join(' '));
  }, [onDone, selected, words]);

  const index = useMemo(() => {
    for (let i = 0; i < words.size; i += 1) {
      if (selected[i] === undefined) {
        return i;
      }
    }

    return -1;
  }, [selected, words.size]);

  const onPressWord = useCallback(
    (val: string) => () => {
      vibrate(HapticEffects.impactLight);
      setSelected(sel => {
        const s = [...sel];
        s[index] = val;
        return s;
      });
    },
    [index],
  );

  const onPressClear = useCallback((i: number) => {
    vibrate(HapticEffects.impactLight);
    setSelected(sel => {
      const s = [...sel];
      s[i] = undefined;
      return s;
    });
  }, []);

  return (
    <PopupContainer style={styles.container} testID={testID}>
      <Text t4 style={styles.title} i18n={I18N.backupVerifyTitle} center />
      {error ? (
        <Text
          t11
          style={styles.error}
          color={Color.textRed1}
          i18n={I18N.backupVerifyError}
          center
        />
      ) : (
        <Text
          t11
          style={styles.textStyle}
          i18n={I18N.backupVerifyDescription}
          center
          color={Color.graphicBase2}
        />
      )}
      <View style={styles.cells}>
        <View>
          {Array.from(words.keys())
            .slice(0, 6)
            .map((k, i) =>
              selected[i] !== undefined ? (
                <FilledCell
                  word={words.get(selected[i] ?? '') ?? ''}
                  key={`${i}_filled`}
                  onPress={() => {
                    onPressClear(i);
                  }}
                />
              ) : (
                <EmptyCell
                  active={index === i}
                  index={i + 1}
                  key={`${i}_empty`}
                />
              ),
            )}
        </View>
        <View>
          {Array.from(words.keys())
            .slice(6, 12)
            .map((k, i) =>
              selected[i + 6] !== undefined ? (
                <FilledCell
                  word={words.get(selected[i + 6] ?? '') ?? ''}
                  key={`${i}_filled`}
                  onPress={() => {
                    onPressClear(i + 6);
                  }}
                />
              ) : (
                <EmptyCell
                  active={index === i + 6}
                  index={i + 7}
                  key={`${i}_empty`}
                />
              ),
            )}
        </View>
      </View>
      <View style={styles.buttons}>
        {buttons.map(val => (
          <Button
            size={ButtonSize.small}
            variant={ButtonVariant.second}
            disabled={selected.includes(val)}
            key={val}
            style={styles.buttonStyle}
            title={words.get(val) ?? ''}
            onPress={onPressWord(val)}
            testID={`${testID}_word_${words.get(val)}`}
          />
        ))}
      </View>
      <Spacer />
      <Button
        disabled={selected.filter(Boolean).length < 12}
        variant={ButtonVariant.contained}
        i18n={I18N.backupVerifyCheck}
        onPress={onPressDone}
        style={styles.margin}
        testID={`${testID}_check`}
      />
    </PopupContainer>
  );
};

const styles = createTheme({
  container: {
    marginHorizontal: 20,
  },
  title: {marginTop: 20, marginBottom: 4},
  textStyle: {
    marginBottom: 16,
  },
  buttons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    marginBottom: 28,
  },
  cells: {
    flexDirection: 'row',
    marginHorizontal: -8,
    marginBottom: 28,
  },
  error: {
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 22,
    paddingVertical: 11,
    marginBottom: 16,
  },
  buttonStyle: {margin: 6},
  margin: {marginVertical: 16},
});
