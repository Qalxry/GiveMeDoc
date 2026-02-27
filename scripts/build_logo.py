import cairosvg
import os

with open(os.path.join(os.path.dirname(__file__), '../public/icons/logo.svg'), 'r') as f:
  svg = f.read()

for size in [16, 48, 128]:
    cairosvg.svg2png(
        bytestring=svg.encode('utf-8'),
        # write_to=f'icon-{size}.png',
        write_to=os.path.join(os.path.dirname(__file__), f'../public/icons/icon-{size}.png'),
        output_width=size,
        output_height=size
    )
    print(f'✓ Generated icon-{size}.png')