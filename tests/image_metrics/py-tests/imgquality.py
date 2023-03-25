from sewar.full_ref import mse, rmse, psnr, uqi, ssim, msssim, scc, vifp
import imageio as iio

from pprint import pprint

IMG_DIR = "../cropped/"


def compare(msg, im1, im2):
	q = {
		'mse': mse(im1, im2),
		'rmse': rmse(im1, im2),
		'psnr': psnr(im1, im2),
		'uqi': uqi(im1, im2),
		'ssim': ssim(im1, im2)[0],
		'msssim': msssim(im1, im2),
		'scc': scc(im1, im2),
		'vifp': vifp(im1, im2),
	}

	pprint(msg + ": " + str(q))


og = iio.imread(IMG_DIR + 'original_500-crop.png')
fant = iio.imread(IMG_DIR + 'og-fant.png')
mDef = iio.imread(IMG_DIR + 'og-minor_defects.png')
c010 = iio.imread(IMG_DIR + 'c10-010-010.png')
c060 = iio.imread(IMG_DIR + 'c10-060-060.png')
c100 = iio.imread(IMG_DIR + 'c10-100-100.png')
c120 = iio.imread(IMG_DIR + 'c10-120-120.png')
c130 = iio.imread(IMG_DIR + 'c10-130-130.png')
c500 = iio.imread(IMG_DIR + 'c10-500-500.png')
c6a5 = iio.imread(IMG_DIR + 'c10-060-500.png')
blak = iio.imread(IMG_DIR + 'black.png')
wite = iio.imread(IMG_DIR + 'white.png')
half = iio.imread(IMG_DIR + 'half.png')


compare("og, og", og, og)
compare("og, fant", og, fant)
compare("og, mDef", og, mDef)
compare("og, c010", og, c010)
compare("og, c060", og, c060)
compare("og, c100", og, c100)
compare("og, c120", og, c120)
compare("og, c130", og, c130)
compare("og, c6a5", og, c6a5)
compare("og, c500", og, c500)
compare("og, blak", og, blak)
compare("og, wite", og, wite)
compare("og, half", og, half)
compare("blak, wite", blak, wite)
compare("blak, half", blak, half)
compare("wite, half", wite, half)
