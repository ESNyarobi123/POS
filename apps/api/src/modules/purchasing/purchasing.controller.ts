import { Controller } from "@nestjs/common";
import { PurchasingService } from "./purchasing.service";

@Controller("purchasing")
export class PurchasingController {
  constructor(private readonly purchasingService: PurchasingService) {}
}
