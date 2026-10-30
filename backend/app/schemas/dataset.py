from pydantic import BaseModel


class Statistics(BaseModel):
    mean: float | None
    median: float | None
    min: float | None
    max: float | None
    std: float | None


class ColumnInfo(BaseModel):
    name: str
    type: str
    unique_values: int
    missing_values: int
    missing_percentage: float


class Correlation(BaseModel):
    column: str
    other_column: str
    value: float


class Outlier(BaseModel):
    count: int
    percentage: float
    lower_bound: float | None
    upper_bound: float | None


class AnalysisOverview(BaseModel):
    rows: int
    columns: int
    numeric_columns: int
    text_columns: int
    missing_values: int
    duplicates: int


class AnalysisResponse(BaseModel):
    overview: AnalysisOverview
    columns: list[ColumnInfo]
    statistics: dict[str, Statistics]
    correlations: list[Correlation]
    missing_values: dict[str, int]
    outliers: dict[str, Outlier]


class DatasetCreateResponse(BaseModel):
    dataset_id: str
    filename: str
    rows: int
    columns: int
    analysis: AnalysisResponse


class DatasetListItem(BaseModel):
    dataset_id: str
    filename: str
    size_bytes: int


class DatasetListResponse(BaseModel):
    count: int
    datasets: list[DatasetListItem]


class DatasetSummaryResponse(BaseModel):
    dataset_id: str
    filename: str
    analysis: AnalysisResponse


class DatasetStatisticsResponse(BaseModel):
    dataset_id: str
    filename: str
    statistics: dict[str, Statistics]
    columns: list[ColumnInfo]
    correlations: list[Correlation]
    outliers: dict[str, Outlier]


class DatasetDeleteResponse(BaseModel):
    dataset_id: str
    filename: str
    deleted: bool


class HistogramData(BaseModel):
    column: str
    values: list[float]


class CategoryData(BaseModel):
    column: str
    labels: list[str]
    values: list[int]


class ScatterData(BaseModel):
    x_column: str
    y_column: str
    x_values: list[float]
    y_values: list[float]


class MissingData(BaseModel):
    column: str
    missing: int
    percentage: float


class ChartDataResponse(BaseModel):
    dataset_id: str
    filename: str
    histograms: list[HistogramData]
    categories: list[CategoryData]
    scatter: list[ScatterData]
    missing: list[MissingData]