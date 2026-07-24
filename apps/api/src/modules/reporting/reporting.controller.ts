import { Controller } from "@nestjs/common";
import { ReportingService } from "./reporting.service";

@Controller("reporting")
export class ReportingController {
  constructor(private readonly reportingService: ReportingService) {}
}
