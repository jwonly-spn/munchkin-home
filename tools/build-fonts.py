# 글꼴 가볍게 만들기(이 PC 에서만 쓰는 도구 — 올리는 사이트가 부르는 파일이 아니에요).
#   사이트 글(docs 의 html·js·css)에 실제로 나오는 글자만 남긴 두 파일을 만들어요.
#     docs/fonts/mk-text.woff2   본문  ← Pretendard Variable (SIL OFL 1.1)
#     docs/fonts/mk-title.woff2  제목  ← G마켓 산스 Bold     (SIL OFL 1.1)
#   OFL 은 고친 글꼴에 원래 이름(Reserved Font Name)을 쓰지 못하게 해서, 글꼴 안 이름을 "MK Text" · "MK Title" 로 바꿔요.
#   글이 바뀌어 새 글자가 생기면 다시 돌려요(안 돌려도 깨지지는 않아요 — 없는 글자는 공식 Pretendard 조각이나 기기 글꼴로 보여요).
# 쓰는 법:  python tools/build-fonts.py <PretendardVariable.woff2> <GmarketSansBold.woff 또는 .otf/.ttf>
#   (fonttools · brotli 가 있어야 해요:  python -m pip install fonttools brotli)
import os, re, sys
from fontTools import subset
from fontTools.ttLib import TTFont

HERE = os.path.dirname(os.path.abspath(__file__))
DOCS = os.path.join(HERE, '..', 'docs')
SOURCES = ['index.html', '404.html', 'site.css', 'stars.js', 'home.js', 'album/index.html', 'album/album.js', 'album/album.css', 'album/beta.js']
# 글에 없어도 늘 넣는 글자: 영문·숫자·기호 전부, 자주 쓰는 문장 부호, 한글을 치는 동안 보이는 낱자(ㄱ~ㅣ)
ALWAYS = ''.join(chr(c) for c in range(0x20, 0x7F)) + '·…—–‘’“”「」『』〈〉《》›‹→←↑↓×÷°※♥♡★☆•▾▴✓₩' + ''.join(chr(c) for c in range(0x3131, 0x3164))


def site_chars():
    chars = set(ALWAYS)
    for rel in SOURCES:
        with open(os.path.join(DOCS, rel), encoding='utf-8') as f:
            chars.update(f.read())
    return {c for c in chars if c >= ' ' and c not in '﻿'}


def build(src, out, family, chars, keep_axes, notice=''):
    opt = subset.Options()
    opt.flavor = 'woff2'
    opt.layout_features = ['*'] if keep_axes else ['kern', 'liga', 'calt', 'ccmp', 'locl', 'mark', 'mkmk']
    opt.name_IDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 11, 13, 14]
    opt.notdef_outline = True
    opt.hinting = False
    opt.desubroutinize = True
    font = TTFont(src)
    sub = subset.Subsetter(opt)
    sub.populate(unicodes=sorted(ord(c) for c in chars))
    sub.subset(font)
    # 이름 바꾸기(OFL Reserved Font Name) — 저작권(0)·라이선스(13·14) 글은 그대로 둬요
    ps = family.replace(' ', '')
    for rec in list(font['name'].names):
        if rec.nameID in (1, 16):
            rec.string = family
        elif rec.nameID in (4, 3):
            rec.string = family + ' (subset for munchkin.com)'
        elif rec.nameID == 6:
            rec.string = ps
        elif rec.nameID in (17, 18, 21, 22, 25):
            font['name'].names.remove(rec)
        elif rec.nameID >= 256 and 'Pretendard' in rec.toUnicode():
            rec.string = rec.toUnicode().replace('PretendardVariable', ps).replace('Pretendard', ps)
    if not font['name'].getName(0, 3, 1, 0x409):   # 원본에 저작권 글이 없으면(G마켓 산스 웹글꼴) 적어 둬요
        font['name'].setName(notice, 0, 3, 1, 0x409)
        font['name'].setName('This Font Software is licensed under the SIL Open Font License, Version 1.1. https://openfontlicense.org', 13, 3, 1, 0x409)
        font['name'].setName('https://openfontlicense.org', 14, 3, 1, 0x409)
    have = {chr(c) for c in font.getBestCmap()}
    font.flavor = 'woff2'
    font.save(out)
    missing = sorted(c for c in chars if c not in have and c > '~')
    return os.path.getsize(out), len(have), missing


if __name__ == '__main__':
    if len(sys.argv) < 3:
        sys.exit(__doc__ or '쓰는 법: python tools/build-fonts.py <PretendardVariable.woff2> <GmarketSansBold.woff>')
    chars = site_chars()
    os.makedirs(os.path.join(DOCS, 'fonts'), exist_ok=True)
    for src, name, family, axes, notice in ((sys.argv[1], 'mk-text.woff2', 'MK Text', True, 'Based on Pretendard. Copyright (c) 2021 Kil Hyung-jin'),
                                            (sys.argv[2], 'mk-title.woff2', 'MK Title', False, 'Based on Gmarket Sans Bold. Copyright (c) Gmarket Inc.')):
        size, n, missing = build(src, os.path.join(DOCS, 'fonts', name), family, chars, axes, notice)
        print(f'{name}: {size / 1024:.0f}KB · 글자 {n}개 · 원본에 없는 글자 {len(missing)}개 {"".join(missing)[:60]}')
