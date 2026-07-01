import 'package:flutter/material.dart';



import '../../theme/app_colors.dart';

import '../../utils/responsive.dart';



class HomeStyles {

  HomeStyles._();



  static EdgeInsetsDirectional horizontalPadding(BuildContext context) =>

      Responsive.padDirectional(context, start: 16, end: 16);



  static EdgeInsetsDirectional sectionPadding(

    BuildContext context, {

    double top = 0,

    double bottom = 0,

  }) =>

      Responsive.padDirectional(

        context,

        start: 16,

        top: top,

        end: 16,

        bottom: bottom,

      );



  static double gridGap(BuildContext context) => context.rg(8);



  static double cardRadius(BuildContext context) => context.cardRadius;

  static double listGap(BuildContext context) => context.rg(8);

  static double cardPadding(BuildContext context) => context.rs(10);



  static List<BoxShadow> cardShadow(BuildContext context, {Color? color}) =>

      Responsive.cardShadow(

        context,

        color: color ?? AppColors.primary,

      );



  static BoxDecoration cardDecoration(

    BuildContext context, {

    Color background = AppColors.white,

    Color borderColor = AppColors.border,

    double borderWidth = 1,

    List<BoxShadow>? shadows,

  }) {

    return BoxDecoration(

      color: background,

      borderRadius: BorderRadius.circular(cardRadius(context)),

      border: Border.all(color: borderColor, width: borderWidth),

      boxShadow: shadows,

    );

  }

}

