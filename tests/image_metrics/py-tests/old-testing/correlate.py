from scipy import signal as sg
import imageio as iio

IMG_DIR = "../../cropped/"

def saveCorrelate(name, im1, im2):
	cor = sg.correlate(im1, im2)
	iio.imwrite('out/'+name, cor)

og = iio.imread(IMG_DIR+'original_500-crop.png')
c010 = iio.imread(IMG_DIR+'c10-010-010.png')
c060 = iio.imread(IMG_DIR+'c10-060-060.png')
c100 = iio.imread(IMG_DIR+'c10-100-100.png')
c120 = iio.imread(IMG_DIR+'c10-120-120.png')
c500 = iio.imread(IMG_DIR+'c10-500-500.png')
c6a5 = iio.imread(IMG_DIR+'c10-060-500.png')

# slow, see https://stackoverflow.com/q/62026550/883015
# cor = sg.correlate2d(og, c010)

# scipy.signal.correlate(in1, in2, mode='full', method='auto')
# https://docs.scipy.org/doc/scipy/reference/generated/scipy.signal.correlate.html#scipy.signal.correlate

# imageio.imwrite(uri, im, format=None, **kwargs)
# https://imageio.readthedocs.io/en/v2.14.0/reference/_core_29/imageio.imwrite.html

saveCorrelate('cor-og-og.png', og, og)
saveCorrelate('cor-010.png', og, c010)
saveCorrelate('cor-060.png', og, c060)
saveCorrelate('cor-100.png', og, c100)
saveCorrelate('cor-120.png', og, c120)
saveCorrelate('cor-500.png', og, c500)
saveCorrelate('cor-6a5.png', og, c6a5)
saveCorrelate('cor-010-500.png', c010, c500)

