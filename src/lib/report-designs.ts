// Shared registry of report designs offered per office (firm).
// "ln" is the current/default design ("تصميم لغة الأرقام"). The others are
// professional variants applied by the report design engine based on the
// firm's selected design.

export interface ReportDesignOption {
  id: string;
  nameAr: string;
  nameEn: string;
  descAr: string;
}

export const REPORT_DESIGNS: ReportDesignOption[] = [
  {
    id: "ln",
    nameAr: "تصميم لغة الأرقام",
    nameEn: "Language of Numbers",
    descAr:
      "التصميم الحالي الاحترافي مع لوحة إدخال البيانات وقسم التصميم والتحكم بالألوان واللوجو.",
  },
  {
    id: "one",
    nameAr: "التصميم الأول",
    nameEn: "Design One",
    descAr:
      "تصميم عصري ملوّن مع داشبورد نهائية وبطاقات KPI وتحليل مالي ورسوم بيانية أسفل كل قائمة.",
  },
  {
    id: "two",
    nameAr: "التصميم الثاني",
    nameEn: "Design Two",
    descAr:
      "تصميم كلاسيكي مؤسسي مع مقارنات ونِسب تغيّر وتوصيات تنفيذية مختصرة وشرح مبسّط لكل نسبة.",
  },
  {
    id: "three",
    nameAr: "التصميم الثالث",
    nameEn: "Design Three",
    descAr:
      "تصميم تنفيذي مختصر يركّز على أهم النسب والقرارات مع داشبورد ملخّصة وشرح لغير الماليين.",
  },
];

export const DEFAULT_REPORT_DESIGN = "ln";

export const REPORT_DESIGN_IDS = REPORT_DESIGNS.map((d) => d.id);

export function reportDesignName(id: string | null | undefined): string {
  const d = REPORT_DESIGNS.find((x) => x.id === id);
  return d ? d.nameAr : REPORT_DESIGNS[0].nameAr;
}
