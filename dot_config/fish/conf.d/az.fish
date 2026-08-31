# Azure context (azie keeps subscription and resource-group defaults scoped to
# the current shell, so parallel terminals cannot accidentally affect each other).
abbr -a azctx 'azie ctx'
abbr -a azctxp 'azie ctx -'
abbr -a azrg 'azie rg'
abbr -a azrgp 'azie rg -'
abbr -a azrgu 'azie rg -u'
abbr -a azinfo 'azie info'

# Account and resource-group inventory in the selected azie context.
abbr -a azs 'az account show -o table'
abbr -a azsl 'az account list -o table'
abbr -a azgl 'az group list -o table'
abbr -a azrl 'az resource list'
abbr -a azrlo 'az resource list -o table'

# Azure Container Apps. Add -n <app> where required; the active resource group
# selected with azie is used as the default.
abbr -a azcal 'az containerapp list -o table'
abbr -a azcael 'az containerapp env list -o table'
abbr -a azcash 'az containerapp show'
abbr -a azcalogs 'az containerapp logs show'
abbr -a azcalogf 'az containerapp logs show --follow'
abbr -a azcarevl 'az containerapp revision list --all'
abbr -a azcarepl 'az containerapp replica list'
abbr -a azcaexec 'az containerapp exec'
