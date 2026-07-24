import { Controller } from "@nestjs/common";
import { WarrantyService } from "./warranty.service";

@Controller("warranty")
export class WarrantyController {
  constructor(private readonly warrantyService: WarrantyService) {}
}
