SelfFundingAirportsDiagnostic = SelfFundingAirportsDiagnostic or {}

SelfFundingAirportsDiagnostic.Version = "0.1.0-read-only"
SelfFundingAirportsDiagnostic.LastCity = nil
SelfFundingAirportsDiagnostic.LastTurn = nil
SelfFundingAirportsDiagnostic.TransportScale = 50
SelfFundingAirportsDiagnostic.Targets = {
	["data/design/buildings/2015/airport/b_freight_airport_t4.class"] = {
		Kind = "freight", Resource = "rfre_0", BaselineCost = 36000, DesignCapacity = 240
	},
	["data/design/buildings/construction/airport/b_transport_smallairport_t3.class"] = {
		Kind = "passenger", Resource = "rpas_0", BaselineCost = 7200, DesignCapacity = 40
	},
	["data/design/buildings/construction/airport/b_transport_airport_t3.class"] = {
		Kind = "passenger", Resource = "rpas_0", BaselineCost = 32400, DesignCapacity = 240
	},
}

function SelfFundingAirportsDiagnostic:Reset()
	self.LastCity = nil
	self.LastTurn = nil
end

function SelfFundingAirportsDiagnostic:NormalizePath(value)
	local normalized = string.lower(tostring(value or ""))
	normalized = string.gsub(normalized, "\\", "/")
	return normalized
end

function SelfFundingAirportsDiagnostic:Clamp01(value)
	return math.max(0, math.min(tonumber(value) or 0, 1))
end

function SelfFundingAirportsDiagnostic:ResourceQty(buildingInfo, resourceName)
	for _, resource in pairs(buildingInfo.ResourceSold or {}) do
		if string.lower(tostring(resource.ResourceName or "")) == resourceName then
			return (tonumber(resource.ResourceQty) or 0) / self.TransportScale
		end
	end
	return 0
end

function SelfFundingAirportsDiagnostic:IsWorker(tokenName)
	return tokenName == "worker1" or tokenName == "worker2" or
		tokenName == "worker3" or tokenName == "worker4"
end

function SelfFundingAirportsDiagnostic:AddUsage(result, tokenName, amount)
	local transportType = CitySaveCalculations.TransportType[tokenName]
	local absoluteAmount = math.abs(tonumber(amount) or 0)
	if self:IsWorker(tokenName) then
		result.worker = result.worker + absoluteAmount
	elseif transportType == 1 then
		result.freight = result.freight + absoluteAmount
	elseif transportType == 2 then
		result.passenger = result.passenger + absoluteAmount
	end
end

function SelfFundingAirportsDiagnostic:OfflineUsage(cityId)
	local result = { freight = 0, passenger = 0, worker = 0, source = "offline-routes" }
	for tokenId = 2, TradingLogic.MaxSoloTokens do
		local tokenName = TradingLogic:GetTokenName(tokenId)
		local routeTable = (SoloTradeMgr.TradeMatrix and SoloTradeMgr.TradeMatrix[tokenName]) or {}
		local localUsage = 0
		for _, amount in pairs(routeTable[cityId] or {}) do
			localUsage = localUsage + math.abs(tonumber(amount) or 0)
		end
		for originCity, destinations in pairs(routeTable) do
			if originCity ~= cityId then
				localUsage = localUsage + math.abs(tonumber(destinations[cityId]) or 0)
			end
		end
		self:AddUsage(result, tokenName, localUsage)
	end
	return result
end

function SelfFundingAirportsDiagnostic:OnlineUsage(cityId)
	local result = { freight = 0, passenger = 0, worker = 0, source = "online-contracts" }
	local contracts = TradingData and TradingData.ContractsByCity and TradingData.ContractsByCity[cityId]
	if contracts == nil then
		result.source = "online-contracts-unavailable"
		return result
	end

	local active = TradingLogic:ContractState("ACTIVE")
	local negotiating = TradingLogic:ContractState("NEGOTIATING")
	local alerted = TradingLogic:ContractState("ALERTED")
	for _, contract in pairs(contracts) do
		local state = contract.m_iState
		if state == active or state == negotiating or state == alerted then
			for tokenId, amount in pairs(contract.m_Tokens or {}) do
				self:AddUsage(result, TradingLogic:GetTokenName(tokenId), amount)
			end
		end
	end
	return result
end

function SelfFundingAirportsDiagnostic:GetUsage(cityId)
	if TradingLogic:OfflineMode() then
		return self:OfflineUsage(cityId)
	end
	return self:OnlineUsage(cityId)
end

function SelfFundingAirportsDiagnostic:CapacityValue(info, resourceName, modeName)
	local resource = info[resourceName]
	local mode = resource and resource[modeName]
	return ((mode and tonumber(mode.CurrentCapacity)) or 0) / self.TransportScale
end

function SelfFundingAirportsDiagnostic:CapacitySummary()
	local info = {}
	City:GetAllCityLinkInterCityInfo(info)
	local result = { detail = info }
	for _, kind in pairs({ "freight", "passenger" }) do
		local resourceName = kind == "freight" and "rfre_0" or "rpas_0"
		result[kind] = { total = 0 }
		for _, modeName in pairs({ "road", "highway", "rail", "sea", "air" }) do
			local value = self:CapacityValue(info, resourceName, modeName)
			result[kind][modeName] = value
			result[kind].total = result[kind].total + value
		end
	end
	return result
end

function SelfFundingAirportsDiagnostic:AirportSummary()
	local result = {
		freight = { count = 0, normal = 0, current = 0, design = 0, baseline = 0, activeBaseline = 0 },
		passenger = { count = 0, normal = 0, current = 0, design = 0, baseline = 0, activeBaseline = 0 },
		instances = {},
	}
	local buildings = {}
	CitizenMgr:GetEntitiesHighlightable(buildings)
	for _, entity in pairs(buildings) do
		local protoPath = self:NormalizePath(Entity:GetProtoPath(entity))
		local target = self.Targets[protoPath]
		if target ~= nil then
			local buildingInfo = {}
			if Entity:GetBuildingInfo(entity, buildingInfo) == true then
				local normal = buildingInfo.State and buildingInfo.State.IsNormal == true
				local capacity = self:ResourceQty(buildingInfo, target.Resource)
				local group = result[target.Kind]
				group.count = group.count + 1
				group.current = group.current + capacity
				group.design = group.design + target.DesignCapacity
				if normal then
					group.normal = group.normal + 1
					group.baseline = group.baseline + target.BaselineCost
					if capacity > 0 then
						group.activeBaseline = group.activeBaseline + target.BaselineCost
					end
				end
				table.insert(result.instances, {
					proto = protoPath,
					kind = target.Kind,
					normal = normal,
					capacity = capacity,
					designCapacity = target.DesignCapacity,
					productivity = buildingInfo.Firm and buildingInfo.Firm.PercentProductivity or -1,
					subsidy = buildingInfo.Firm and buildingInfo.Firm.SubventionFromCity or 0,
					profitability = buildingInfo.Firm and buildingInfo.Firm.Profitability or 0,
					resourceSale = City:GetEntBuildingLastResourceSale(entity) or 0,
					resourceCost = City:GetEntBuildingLastResourceCost(entity) or 0,
					upkeepCost = City:GetEntBuildingLastUpkeepCost(entity) or 0,
					workerCost = City:GetEntBuildingLastWorkerCost(entity) or 0,
				})
			end
		end
	end
	return result
end

function SelfFundingAirportsDiagnostic:Policy(usage, totalCapacity, airportCapacity)
	if airportCapacity <= 0 then
		return 0, 0
	end
	local proportional = self:Clamp01(usage / math.max(totalCapacity, airportCapacity))
	local nonTargetCapacity = math.max(totalCapacity - airportCapacity, 0)
	local residual = self:Clamp01((usage - nonTargetCapacity) / airportCapacity)
	return proportional, residual
end

function SelfFundingAirportsDiagnostic:BudgetSummary()
	local info = {}
	City:GetAllCityBudgetInfo(info)
	local upkeep = info.ExpensesDetail and info.ExpensesDetail.UPKEEP or {}
	return {
		cash = Sim.Money and Sim.Money.Cash or 0,
		cashFlow = Sim.Money and Sim.Money.CashFlow or 0,
		forecastIncome = Sim.Money and Sim.Money.NextTurnForecastIncomes or 0,
		forecastExpense = Sim.Money and Sim.Money.NextTurnForecastExpenses or 0,
		budgetCash = info.Cash or 0,
		budgetCashFlow = info.CashFlow or 0,
		incomes = info.Incomes or 0,
		expenses = info.Expenses or 0,
		publicTransport = upkeep.TRANSPORT_PUBLICTRANSPORTS or 0,
		cityLinks = upkeep.TRANSPORT_CITYLINKS or 0,
	}
end

function SelfFundingAirportsDiagnostic:Sample(reason, force)
	if Sim == nil or Sim.Globals == nil or not Sim:IsSimReady() then
		return
	end
	local cityId = TradingLogic:GetCurrentCityId()
	local turn = Sim.Globals.CurrentTurn or -1
	local step = Sim.Globals.CurrentStep or -1
	if not force and self.LastCity == cityId and self.LastTurn == turn then
		return
	end
	self.LastCity = cityId
	self.LastTurn = turn

	local capacity = self:CapacitySummary()
	local airports = self:AirportSummary()
	local usage = self:GetUsage(cityId)
	local budget = self:BudgetSummary()
	local propF, residualF = self:Policy(usage.freight, capacity.freight.total, airports.freight.current)
	local propP, residualP = self:Policy(usage.passenger, capacity.passenger.total, airports.passenger.current)
	local propRebate = 0.8 * (airports.freight.activeBaseline * propF + airports.passenger.activeBaseline * propP)
	local residualRebate = 0.8 * (airports.freight.activeBaseline * residualF + airports.passenger.activeBaseline * residualP)

	LOG_INFO("[SFA_DIAG] version="..self.Version.." reason="..tostring(reason)..
		" city="..tostring(cityId).." turn="..tostring(turn).." step="..tostring(step)..
		" usage_source="..usage.source)
	LOG_INFO("[SFA_DIAG] usage freight="..tostring(usage.freight)..
		" passenger_eligible="..tostring(usage.passenger).." passenger_workers_excluded="..tostring(usage.worker))
	LOG_INFO("[SFA_DIAG] freight_capacity road="..capacity.freight.road.." highway="..capacity.freight.highway..
		" rail="..capacity.freight.rail.." sea="..capacity.freight.sea.." air="..capacity.freight.air..
		" total="..capacity.freight.total)
	LOG_INFO("[SFA_DIAG] passenger_capacity road="..capacity.passenger.road.." highway="..capacity.passenger.highway..
		" rail="..capacity.passenger.rail.." sea="..capacity.passenger.sea.." air="..capacity.passenger.air..
		" total="..capacity.passenger.total)
	LOG_INFO("[SFA_DIAG] target_freight count="..airports.freight.count.." normal="..airports.freight.normal..
		" current_capacity="..airports.freight.current.." design_capacity="..airports.freight.design..
		" baseline="..airports.freight.baseline)
	LOG_INFO("[SFA_DIAG] target_passenger count="..airports.passenger.count.." normal="..airports.passenger.normal..
		" current_capacity="..airports.passenger.current.." design_capacity="..airports.passenger.design..
		" baseline="..airports.passenger.baseline)
	LOG_INFO("[SFA_DIAG] policy proportional freight_util="..propF.." passenger_util="..propP..
		" rebate="..propRebate.." residual freight_util="..residualF.." passenger_util="..residualP..
		" rebate="..residualRebate)
	LOG_INFO("[SFA_DIAG] budget cash="..tostring(budget.cash).." cashflow="..tostring(budget.cashFlow)..
		" forecast_income="..tostring(budget.forecastIncome).." forecast_expense="..tostring(budget.forecastExpense)..
		" budget_cash="..tostring(budget.budgetCash).." budget_cashflow="..tostring(budget.budgetCashFlow)..
		" incomes="..tostring(budget.incomes).." expenses="..tostring(budget.expenses)..
		" upkeep_public_transport="..tostring(budget.publicTransport).." upkeep_citylinks="..tostring(budget.cityLinks))
	for index, instance in ipairs(airports.instances) do
		LOG_INFO("[SFA_DIAG] airport index="..index.." proto="..instance.proto.." kind="..instance.kind..
			" normal="..tostring(instance.normal).." capacity="..instance.capacity..
			" design_capacity="..instance.designCapacity.." productivity="..tostring(instance.productivity)..
			" subsidy="..tostring(instance.subsidy).." profitability="..tostring(instance.profitability)..
			" last_resource_sale="..tostring(instance.resourceSale).." last_resource_cost="..tostring(instance.resourceCost)..
			" last_upkeep="..tostring(instance.upkeepCost).." last_workers="..tostring(instance.workerCost))
	end
end

function SelfFundingAirportsDiagnostic:SafeSample(reason, force)
	local ok, message = pcall(function() self:Sample(reason, force) end)
	if not ok then
		LOG_WARNING("[SFA_DIAG] sample_failed reason="..tostring(reason).." error="..tostring(message))
	end
end
