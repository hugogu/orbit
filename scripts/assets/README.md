# Share-card font

`orbit-share.otf` is a renamed subset of **Noto Sans CJK SC Regular** by the
Noto Project Authors, distributed under the SIL Open Font License 1.1 in
[OFL.txt](OFL.txt). The copyright notice is also retained inside the font.
The subset covers the Chinese, English and Japanese labels currently used
in share images; it is loaded explicitly by Sharp/Pango, without relying
on installed system fonts or a network request during builds.

Source: [Noto CJK](https://github.com/notofonts/noto-cjk/blob/f8d157532fbfaeda587e826d4cd5b21a49186f7c/Sans/OTF/SimplifiedChinese/NotoSansCJKsc-Regular.otf),
revision `f8d157532fbfaeda587e826d4cd5b21a49186f7c`.

To add a label containing new characters, update `profile-font-characters.txt`,
download the pinned source font, then run FontTools 4.65.0:

```sh
pyftsubset NotoSansCJKsc-Regular.otf \
  --text-file=scripts/assets/profile-font-characters.txt \
  --output-file=scripts/assets/orbit-share.otf \
  --name-IDs='*' --name-languages='*' --layout-features='*'
```

Rename name IDs 1, 4 and 16 to `Orbit Share` and ID 6 to `OrbitShare-Regular`
with FontTools (`TTFont`) before saving. Preserve copyright and license
records. `npm test` exercises every localized label; the generator fails if
an unlisted character would silently fall back to another font.
