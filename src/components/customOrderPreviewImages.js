import chocoOneLayer from '../assets/cakepage/choco_onelayer.png'
import chocoTwoLayer from '../assets/cakepage/choco_twolayer.png'
import chocoThreeLayer from '../assets/cakepage/choco_threelayer.png'
import redVelvetOneLayer from '../assets/cakepage/redvelvet_onelayer.png'
import redVelvetTwoLayer from '../assets/cakepage/redvelvet_twolayer.png'
import redVelvetThreeLayer from '../assets/cakepage/redvelvet_thirdlayer.png'
import chocolateSixPcs from '../assets/cupcakepage/chocolate_sixpcs.png'
import chocolateTwelvePcs from '../assets/cupcakepage/chocolate_twelvepcs.png'
import chocolateEighteenPcs from '../assets/cupcakepage/chocolate_eighteenpcs.png'
import redVelvetSixPcs from '../assets/cupcakepage/redvelvet_sixpcs.png'
import redVelvetTwelvePcs from '../assets/cupcakepage/redvelvet_twelvepcs.png'
import redVelvetEighteenPcs from '../assets/cupcakepage/redvelvet_eighteenpcs.png'
import image1Cake6Chocolate from '../assets/packagepage/1cake_6cupcakes_chocolate.png'
import image1Cake6RedVelvet from '../assets/packagepage/1cake_6cupcakes_redvelvet.png'
import image1Cake12Chocolate from '../assets/packagepage/1cake_12cupcakes_chocolate.png'
import image1Cake12RedVelvet from '../assets/packagepage/1cake_12cupcakes_redvelvet.png'
import image1Cake18Chocolate from '../assets/packagepage/1cake_18cupcakes_chocolate.png'
import image1Cake18RedVelvet from '../assets/packagepage/1cake_18cupcakes_redvelvet.png'
import image2Cake6Chocolate from '../assets/packagepage/2cake_6cupcakes_chocolate.png'
import image2Cake6RedVelvet from '../assets/packagepage/2cake_6cupcakes_redvelvet.png'
import image2Cake12Chocolate from '../assets/packagepage/2cake_12cupcakes_chocolate.png'
import image2Cake12RedVelvet from '../assets/packagepage/2cake_12cupcakes_redvelvet.png'
import image2Cake18Chocolate from '../assets/packagepage/2cake_18cupcakes_chocolate.png'
import image2Cake18RedVelvet from '../assets/packagepage/2cake_18cupcakes_redvelvet.png'
import image3Cake6Chocolate from '../assets/packagepage/3cake_6cupcakes_chocolate.png'
import image3Cake6RedVelvet from '../assets/packagepage/3cake_6cupcakes_redvelvet.png'
import image3Cake12Chocolate from '../assets/packagepage/3cake_12cupcakes_chocolate.png'
import image3Cake12RedVelvet from '../assets/packagepage/3cake_12cupcakes_redvelvet.png'
import image3Cake18Chocolate from '../assets/packagepage/3cake_18cupcakes_chocolate.png'
import image3Cake18RedVelvet from '../assets/packagepage/3cake_18cupcakes_redvelvet.png'

// The exact preview assets the customer sees during customization, shared by
// the customer flow and the Admin Orders thumbnails so both sides always show
// the same flavor/layers/quantity preview built from the customer's selections.
export const CUSTOM_CAKE_PREVIEW_IMAGES = {
  chocolate: {
    1: chocoOneLayer,
    2: chocoTwoLayer,
    3: chocoThreeLayer,
  },
  redvelvet: {
    1: redVelvetOneLayer,
    2: redVelvetTwoLayer,
    3: redVelvetThreeLayer,
  },
}

export const CUSTOM_CUPCAKE_PREVIEW_IMAGES = {
  chocolate: {
    6: chocolateSixPcs,
    12: chocolateTwelvePcs,
    18: chocolateEighteenPcs,
  },
  redvelvet: {
    6: redVelvetSixPcs,
    12: redVelvetTwelvePcs,
    18: redVelvetEighteenPcs,
  },
}

export const CUSTOM_PACKAGE_PREVIEW_IMAGES = {
  chocolate: {
    '1-6': image1Cake6Chocolate,
    '1-12': image1Cake12Chocolate,
    '1-18': image1Cake18Chocolate,
    '2-6': image2Cake6Chocolate,
    '2-12': image2Cake12Chocolate,
    '2-18': image2Cake18Chocolate,
    '3-6': image3Cake6Chocolate,
    '3-12': image3Cake12Chocolate,
    '3-18': image3Cake18Chocolate,
  },
  redvelvet: {
    '1-6': image1Cake6RedVelvet,
    '1-12': image1Cake12RedVelvet,
    '1-18': image1Cake18RedVelvet,
    '2-6': image2Cake6RedVelvet,
    '2-12': image2Cake12RedVelvet,
    '2-18': image2Cake18RedVelvet,
    '3-6': image3Cake6RedVelvet,
    '3-12': image3Cake12RedVelvet,
    '3-18': image3Cake18RedVelvet,
  },
}