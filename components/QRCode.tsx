import { memo, useMemo } from 'react';
import { View } from 'react-native';
import qrcode from 'qrcode-generator';

// QR code drawn with plain Views, so it needs no native module (react-native-svg
// isn't in the binary) and can ship over an OTA update. Each row merges runs of
// dark modules into one View to keep the view count down (~300 instead of ~1000).

type Props = {
  value: string;
  size: number;
  color?: string;
  backgroundColor?: string;
};

function QRCodeImpl({ value, size, color = '#000', backgroundColor = '#fff' }: Props) {
  const { rows, count } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(value);
    qr.make();
    const n = qr.getModuleCount();
    const out: { start: number; len: number }[][] = [];
    for (let r = 0; r < n; r++) {
      const runs: { start: number; len: number }[] = [];
      let c = 0;
      while (c < n) {
        if (!qr.isDark(r, c)) { c++; continue; }
        const start = c;
        while (c < n && qr.isDark(r, c)) c++;
        runs.push({ start, len: c - start });
      }
      out.push(runs);
    }
    return { rows: out, count: n };
  }, [value]);

  // Whole-pixel modules so neighbouring rows never leave hairline gaps.
  const cell = Math.max(1, Math.floor(size / count));
  const actual = cell * count;

  return (
    <View style={{ width: actual, height: actual, backgroundColor }}>
      {rows.map((runs, r) =>
        runs.map(({ start, len }) => (
          <View
            key={`${r}-${start}`}
            style={{
              position: 'absolute',
              top: r * cell,
              left: start * cell,
              width: len * cell,
              height: cell,
              backgroundColor: color,
            }}
          />
        )),
      )}
    </View>
  );
}

export const QRCode = memo(QRCodeImpl);
